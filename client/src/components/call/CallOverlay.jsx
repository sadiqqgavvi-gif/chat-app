import { useEffect, useRef, useState } from "react";
import {
  FiMic,
  FiMicOff,
  FiPhone,
  FiPhoneOff,
  FiVideo,
  FiVideoOff,
} from "react-icons/fi";
import Avatar from "../ui/Avatar";
import { useCall } from "../../context/contexts";
import { formatDuration } from "../../lib/format";

function StreamVideo({ stream, muted = false, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function StreamAudio({ stream }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <audio ref={ref} autoPlay />;
}

function Timer({ startedAt }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return formatDuration(Math.max(0, (now - startedAt) / 1000));
}

function RoundButton({ label, onClick, className, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl text-white transition-transform hover:scale-105 ${className}`}
    >
      {children}
    </button>
  );
}

function CallOverlay() {
  const { call, acceptCall, hangUp, toggleMute, toggleCamera } = useCall();
  if (!call) return null;

  const { peer, video, status, direction } = call;
  const ringing = direction === "incoming" && status === "ringing";
  const showRemoteVideo = video && status === "active" && call.remoteStream;
  const kind = video ? "video" : "voice";

  let statusText;
  if (ringing) statusText = `Incoming ${kind} call`;
  else if (status === "calling") statusText = "Calling…";
  else if (status === "connecting") statusText = "Connecting…";
  else statusText = <Timer startedAt={call.startedAt} />;

  return (
    <div
      className="fixed inset-0 z-[80] flex animate-fade-in flex-col items-center justify-between bg-slate-950 text-white"
      role="dialog"
      aria-label={`${kind} call with ${peer.name}`}
    >
      {showRemoteVideo && (
        <StreamVideo
          stream={call.remoteStream}
          muted
          className="absolute inset-0 h-full w-full object-contain"
        />
      )}
      {call.remoteStream && <StreamAudio stream={call.remoteStream} />}

      <div
        className={`relative z-10 flex flex-col items-center px-6 pt-16 text-center ${
          showRemoteVideo
            ? "w-full bg-gradient-to-b from-black/70 to-transparent pb-10 pt-8"
            : ""
        }`}
      >
        {!showRemoteVideo && (
          <Avatar
            src={peer.avatar}
            name={peer.name}
            id={peer._id}
            size="2xl"
            className={status !== "active" ? "animate-pulse" : ""}
          />
        )}
        <h2 className={`font-semibold ${showRemoteVideo ? "text-lg" : "mt-6 text-2xl"}`}>
          {peer.name}
        </h2>
        <p className="mt-1 text-sm tabular-nums text-white/70">{statusText}</p>
      </div>

      {video && call.localStream && !call.cameraOff && (
        <StreamVideo
          stream={call.localStream}
          muted
          className="absolute bottom-32 right-4 z-10 h-40 w-28 -scale-x-100 rounded-xl border border-white/20 bg-black object-cover shadow-xl sm:h-48 sm:w-36"
        />
      )}

      <div className="relative z-10 flex items-center gap-5 pb-[max(2.5rem,env(safe-area-inset-bottom))]">
        {ringing ? (
          <>
            <RoundButton label="Decline" onClick={hangUp} className="bg-red-600">
              <FiPhoneOff />
            </RoundButton>
            <RoundButton label="Accept" onClick={acceptCall} className="bg-green-600">
              {video ? <FiVideo /> : <FiPhone />}
            </RoundButton>
          </>
        ) : (
          <>
            <RoundButton
              label={call.muted ? "Unmute" : "Mute"}
              onClick={toggleMute}
              className={call.muted ? "bg-white !text-slate-900" : "bg-white/15"}
            >
              {call.muted ? <FiMicOff /> : <FiMic />}
            </RoundButton>
            {video && (
              <RoundButton
                label={call.cameraOff ? "Turn camera on" : "Turn camera off"}
                onClick={toggleCamera}
                className={call.cameraOff ? "bg-white !text-slate-900" : "bg-white/15"}
              >
                {call.cameraOff ? <FiVideoOff /> : <FiVideo />}
              </RoundButton>
            )}
            <RoundButton label="End call" onClick={hangUp} className="bg-red-600">
              <FiPhoneOff />
            </RoundButton>
          </>
        )}
      </div>
    </div>
  );
}

export default CallOverlay;
