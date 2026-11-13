// Renders message text with clickable links and WhatsApp-style
// formatting: *bold*, _italic_, ~strikethrough~ and `code`.

const TOKEN =
  /(https?:\/\/[^\s<]+[^\s<.,:;"')\]!?])|(`[^`\n]+`)|(\*[^\s*](?:[^*\n]*[^\s*])?\*)|(_[^\s_](?:[^_\n]*[^\s_])?_)|(~[^\s~](?:[^~\n]*[^\s~])?~)/g;

export function renderRichText(text, { linkClass = "" } = {}) {
  const nodes = [];
  let last = 0;
  let key = 0;

  for (const match of text.matchAll(TOKEN)) {
    const [token, url, code, bold, italic, strike] = match;
    if (match.index > last) nodes.push(text.slice(last, match.index));
    last = match.index + token.length;
    key += 1;

    if (url) {
      nodes.push(
        <a
          key={key}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`underline underline-offset-2 break-all ${linkClass}`}
          onClick={(event) => event.stopPropagation()}
        >
          {url}
        </a>,
      );
    } else if (code) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em]"
        >
          {code.slice(1, -1)}
        </code>,
      );
    } else if (bold) {
      nodes.push(<strong key={key}>{bold.slice(1, -1)}</strong>);
    } else if (italic) {
      nodes.push(<em key={key}>{italic.slice(1, -1)}</em>);
    } else if (strike) {
      nodes.push(<s key={key}>{strike.slice(1, -1)}</s>);
    }
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}
