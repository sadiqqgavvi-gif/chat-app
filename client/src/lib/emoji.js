const split = (text) => text.split(" ");

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    icon: "😀",
    label: "Smileys & people",
    emojis: split(
      "😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🤫 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 😎 🤓 🧐 😕 😟 🙁 😮 😯 😲 😳 🥺 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 💩 🤡 👻 👽 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾",
    ),
  },
  {
    id: "gestures",
    icon: "👋",
    label: "Gestures",
    emojis: split(
      "👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🙇 🤦 🤷 👮 🕵️ 💂 👷 🤴 👸 👳 🧕 🤵 👰 🤰 👼 🎅 🦸 🦹 🧙 🧚 🧛 🧜 🧝 💆 💇 🚶 🏃 💃 🕺 👯 🧘 👫 👭 👬 💏 💑 👪",
    ),
  },
  {
    id: "hearts",
    icon: "❤️",
    label: "Hearts & symbols",
    emojis: split(
      "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 💌 💋 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 💤 ✨ ⭐ 🌟 🔥 ⚡ ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ❓ ❔ ❕ ❗ ⚠️ 🚫 ⛔ 🔞 ♻️ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🔺 🔻 🔶 🔷 🆗 🆕 🆒 🆓 🔝 🔜 ™️ ©️ ®️ 🎵 🎶 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ 🔄 🔔 🔕 📣 📢",
    ),
  },
  {
    id: "nature",
    icon: "🐶",
    label: "Animals & nature",
    emojis: split(
      "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🐛 🦋 🐌 🐞 🐜 🕷️ 🦂 🐢 🐍 🦎 🐙 🦑 🦐 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🐘 🦏 🐪 🐫 🦒 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🐐 🦌 🐕 🐩 🐈 🐓 🦃 🕊️ 🐇 🐁 🐿️ 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍃 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌙 🌍 🪐 ☀️ ⛅ ☁️ 🌧️ ⛈️ 🌩️ ❄️ ☃️ 🌈 🌊 💧 ☔",
    ),
  },
  {
    id: "food",
    icon: "🍔",
    label: "Food & drink",
    emojis: split(
      "🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🌽 🥕 🧄 🧅 🥔 🍠 🥐 🍞 🥖 🥨 🧀 🥚 🍳 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🥗 🥘 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍥 🥠 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 ☕ 🍵 🧃 🥤 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🍾 🧊 🥄 🍴 🍽️",
    ),
  },
  {
    id: "activity",
    icon: "⚽",
    label: "Activities",
    emojis: split(
      "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🏓 🏸 🏒 🏑 🥍 🏏 🥅 ⛳ 🏹 🎣 🥊 🥋 🎽 🛹 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩 🎉 🎊 🎈 🎁 🎀 🪄",
    ),
  },
  {
    id: "travel",
    icon: "🚗",
    label: "Travel & places",
    emojis: split(
      "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 💺 🚀 🛸 🚁 🛶 ⛵ 🚤 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🏠 🏡 🏘️ 🏗️ 🏭 🏢 🏬 🏣 🏥 🏦 🏨 🏪 🏫 🏛️ ⛪ 🕌 🕍 🕋 ⛩️ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 🎆 🎇 🌠",
    ),
  },
  {
    id: "objects",
    icon: "💡",
    label: "Objects",
    emojis: split(
      "⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 💾 💿 📀 📷 📸 📹 🎥 📞 ☎️ 📟 📠 📺 📻 🎙️ ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🧯 💸 💵 💴 💶 💷 💰 💳 💎 ⚖️ 🧰 🔧 🔨 ⚒️ 🛠️ ⛏️ 🔩 ⚙️ 🧱 🧲 🔫 💣 🔪 🗡️ 🛡️ 🚬 ⚰️ 🏺 🔮 📿 💈 🔭 🔬 💊 💉 🩹 🩺 🌡️ 🧹 🧺 🧻 🚽 🚿 🛁 🧼 🔑 🗝️ 🚪 🛋️ 🛏️ 🧸 🖼️ 🛍️ 🛒 🎁 ✉️ 📩 📨 📧 📥 📤 📦 🏷️ 📪 📜 📃 📄 📑 📊 📈 📉 🗒️ 📅 📆 📇 🗃️ 🗳️ 📋 📁 📂 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🔗 📎 📐 📏 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 📝 ✏️ 🔍 🔎 🔒 🔓",
    ),
  },
];

const RECENT_KEY = "emoji.recent";

export const getRecentEmojis = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENT_KEY));
    return Array.isArray(stored) ? stored.slice(0, 24) : [];
  } catch {
    return [];
  }
};

export const rememberEmoji = (emoji) => {
  const next = [emoji, ...getRecentEmojis().filter((item) => item !== emoji)];
  localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 24)));
};

// True for messages made of one to three emoji, which are shown larger.
export const isEmojiOnly = (text = "") => {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 24) return false;
  if (!/^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\s)+$/u.test(trimmed)) {
    return false;
  }
  const count = trimmed.match(/\p{Extended_Pictographic}/gu)?.length || 0;
  return count >= 1 && count <= 3;
};
