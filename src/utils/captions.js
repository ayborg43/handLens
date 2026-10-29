// Builds a WebVTT caption track for one step from its verbatim workshop line
// (and the English instruction when it differs), so every clip is captioned.
export function buildCaptionsUrl(step, englishToo) {
  const lines = [];
  const verbatim = step.human.transcript_pidgin || step.human.transcript_local;
  // Captions are for what was said. With no transcript there is nothing to caption.
  if (!verbatim) return null;
  lines.push(verbatim);
  if (englishToo && step.human.instruction && step.human.instruction !== verbatim) {
    lines.push(step.human.instruction);
  }
  const vtt = `WEBVTT\n\n00:00:00.000 --> 00:59:59.000\n${lines.join('\n')}\n`;
  return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
}
