import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CallContext, useChat, useToast } from "./contexts";
import socket from "../lib/socket";
import { otherUserOf } from "../lib/format";
import { showDesktopNotification, startRingtone } from "../lib/notify";

// STUN is enough for most home networks. Calls across strict NATs need a
// TURN server, which can be supplied as JSON in VITE_ICE_SERVERS.
const parseIceServers = () => {
  try {
    const custom = JSON.parse(import.meta.env.VITE_ICE_SERVERS || "null");
    if (Array.isArray(custom) && custom.length > 0) return custom;
  } catch {
    // fall through to the default
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
};
const ICE_SERVERS = parseIceServers();

const END_MESSAGES = {
  offline: (name) => `${name} is not available right now.`,
  busy: (name) => `${name} is on another call.`,
  no_answer: (name) => `${name} didn't answer.`,
  blocked: () => "You can't call this contact.",
  invalid: () => "The call could not be started.",
  declined: (name) => `${name} declined the call.`,
  failed: () => "The call connection was lost.",
};

// One-to-one voice and video calls over WebRTC. Media flows directly
// between the two browsers; the socket only carries the signalling.
export function CallProvider({ children }) {
  const { me } = useChat();
  const { toast, toastError } = useToast();

  // { id, chatId, peer, video, direction, status, startedAt, muted,
  //   cameraOff, localStream, remoteStream }
  const [call, setCall] = useState(null);

  const callRef = useRef(null);
  const peerRef = useRef(null);
  const offerRef = useRef(null);
  const queuedIce = useRef([]);
  const stopRing = useRef(() => {});

  useEffect(() => {
    callRef.current = call;
  });

  const patchCall = useCallback((changes) => {
    setCall((current) => (current ? { ...current, ...changes } : current));
  }, []);

  const cleanup = useCallback(
    (reason) => {
      const current = callRef.current;
      stopRing.current();
      stopRing.current = () => {};

      peerRef.current?.close();
      peerRef.current = null;
      current?.localStream?.getTracks().forEach((track) => track.stop());
      offerRef.current = null;
      queuedIce.current = [];
      callRef.current = null;
      setCall(null);

      const message = END_MESSAGES[reason]?.(current?.peer?.name || "They");
      if (message) toast(message);
    },
    [toast],
  );

  const hangUp = useCallback(() => {
    const current = callRef.current;
    if (!current) return;
    socket.emit("call:end", { callId: current.id });
    cleanup();
  }, [cleanup]);

  const createPeer = useCallback(
    (callId, stream) => {
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerRef.current = peer;
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));

      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("call:ice", { callId, candidate: event.candidate });
        }
      };
      peer.ontrack = (event) => {
        patchCall({ remoteStream: event.streams[0] });
      };
      peer.onconnectionstatechange = () => {
        if (peerRef.current !== peer) return;
        if (peer.connectionState === "connected") {
          setCall((current) =>
            current && current.status !== "active"
              ? { ...current, status: "active", startedAt: Date.now() }
              : current,
          );
        } else if (peer.connectionState === "failed") {
          socket.emit("call:end", { callId });
          cleanup("failed");
        }
      };
      return peer;
    },
    [patchCall, cleanup],
  );

  const flushIce = useCallback(async () => {
    const peer = peerRef.current;
    const pending = queuedIce.current;
    queuedIce.current = [];
    for (const candidate of pending) {
      await peer?.addIceCandidate(candidate).catch(() => {});
    }
  }, []);

  const getMedia = useCallback(
    async (video) => {
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
        toastError("Calls aren't supported in this browser.");
        return null;
      }
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: video ? { facingMode: "user" } : false,
        });
      } catch {
        toastError(
          video
            ? "Allow camera and microphone access to make video calls."
            : "Allow microphone access to make calls.",
        );
        return null;
      }
    },
    [toastError],
  );

  const startCall = useCallback(
    async (chat, video) => {
      if (callRef.current) return;
      const peerUser = otherUserOf(chat, me);
      if (!peerUser) return;

      // Reserve the slot straight away so a double click can't start two.
      const id = crypto.randomUUID();
      const next = {
        id,
        chatId: chat._id,
        peer: peerUser,
        video,
        direction: "outgoing",
        status: "calling",
        muted: false,
        cameraOff: false,
        localStream: null,
        remoteStream: null,
      };
      callRef.current = next;
      setCall(next);

      const stream = await getMedia(video);
      if (callRef.current?.id !== id) {
        stream?.getTracks().forEach((track) => track.stop());
        return;
      }
      if (!stream) {
        cleanup();
        return;
      }
      callRef.current = { ...next, localStream: stream };
      patchCall({ localStream: stream });

      const peer = createPeer(id, stream);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      stopRing.current = startRingtone(false);

      socket
        .timeout(10000)
        .emit(
          "call:invite",
          { callId: id, chatId: chat._id, video, offer },
          (err, reply) => {
            if (callRef.current?.id !== id) return;
            if (err) cleanup("invalid");
            else if (reply?.error) cleanup(reply.error);
          },
        );
    },
    [me, getMedia, createPeer, patchCall, cleanup],
  );

  const acceptCall = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.status !== "ringing") return;

    stopRing.current();
    patchCall({ status: "connecting" });

    const stream = await getMedia(current.video);
    if (callRef.current?.id !== current.id) {
      stream?.getTracks().forEach((track) => track.stop());
      return;
    }
    if (!stream) {
      hangUp();
      return;
    }
    callRef.current = { ...callRef.current, localStream: stream };
    patchCall({ localStream: stream });

    try {
      const peer = createPeer(current.id, stream);
      await peer.setRemoteDescription(offerRef.current);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      socket.emit("call:answer", { callId: current.id, answer });
      await flushIce();
    } catch {
      hangUp();
      toastError("The call could not be connected.");
    }
  }, [getMedia, createPeer, patchCall, flushIce, hangUp, toastError]);

  useEffect(() => {
    const onIncoming = ({ callId, chatId, video, offer, from }) => {
      if (callRef.current) return;

      offerRef.current = offer;
      queuedIce.current = [];
      const next = {
        id: callId,
        chatId,
        peer: from,
        video,
        direction: "incoming",
        status: "ringing",
        muted: false,
        cameraOff: false,
        localStream: null,
        remoteStream: null,
      };
      callRef.current = next;
      setCall(next);

      stopRing.current = startRingtone(true);
      if (document.visibilityState !== "visible") {
        showDesktopNotification({
          title: from.name,
          body: `Incoming ${video ? "video" : "voice"} call`,
          icon: from.avatar || undefined,
          tag: `call-${callId}`,
        });
      }
    };

    const onAnswered = async ({ callId, answer }) => {
      if (callRef.current?.id !== callId || !peerRef.current) return;
      stopRing.current();
      patchCall({ status: "connecting" });
      try {
        await peerRef.current.setRemoteDescription(answer);
        await flushIce();
      } catch {
        hangUp();
      }
    };

    const onIce = ({ callId, candidate }) => {
      if (callRef.current?.id !== callId) return;
      const peer = peerRef.current;
      if (peer?.remoteDescription) peer.addIceCandidate(candidate).catch(() => {});
      else queuedIce.current.push(candidate);
    };

    const onEnded = ({ callId, reason }) => {
      const current = callRef.current;
      if (current?.id !== callId) return;
      // The other side hanging up while we are still ringing them means
      // they declined.
      const declined =
        reason === "ended" &&
        current.direction === "outgoing" &&
        current.status === "calling";
      cleanup(declined ? "declined" : reason);
    };

    socket.on("call:incoming", onIncoming);
    socket.on("call:answered", onAnswered);
    socket.on("call:ice", onIce);
    socket.on("call:ended", onEnded);
    return () => {
      socket.off("call:incoming", onIncoming);
      socket.off("call:answered", onAnswered);
      socket.off("call:ice", onIce);
      socket.off("call:ended", onEnded);
    };
  }, [patchCall, flushIce, hangUp, cleanup]);

  // Leaving the page (or logging out) ends any call in progress.
  useEffect(() => {
    const end = () => {
      if (callRef.current) socket.emit("call:end", { callId: callRef.current.id });
    };
    window.addEventListener("pagehide", end);
    return () => {
      window.removeEventListener("pagehide", end);
      end();
      stopRing.current();
      peerRef.current?.close();
      callRef.current?.localStream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const toggleMute = useCallback(() => {
    const current = callRef.current;
    if (!current?.localStream) return;
    const muted = !current.muted;
    current.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    patchCall({ muted });
  }, [patchCall]);

  const toggleCamera = useCallback(() => {
    const current = callRef.current;
    if (!current?.localStream) return;
    const cameraOff = !current.cameraOff;
    current.localStream.getVideoTracks().forEach((track) => {
      track.enabled = !cameraOff;
    });
    patchCall({ cameraOff });
  }, [patchCall]);

  const value = useMemo(
    () => ({ call, startCall, acceptCall, hangUp, toggleMute, toggleCamera }),
    [call, startCall, acceptCall, hangUp, toggleMute, toggleCamera],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
