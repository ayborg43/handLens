// Bundles everything a skill produces into one zip: the canonical skill.json,
// robot files, the VR page, and the AI evidence. Missing files are skipped.
async function grab(url, isHtml) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!isHtml && type.includes('text/html')) return null; // SPA fallback
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function downloadSkillPack(skill) {
  const { zipSync } = await import('fflate');
  const base = `/models/${skill.project_id}`;
  const wanted = [
    ['skill.json'],
    ['status.json'],
    ['ai/transcript.json'],
    ['ai/masks.json'],
    ['files/workshop.urdf'],
    ['webxr/index.html', true],
    ['webxr/anchors.json'],
    ['webxr/manifest.json']
  ];
  skill.steps.forEach((s) => {
    const name = s.robot && s.robot.urdf_trajectory;
    if (name) wanted.push([`files/${name}`]);
  });

  const files = {};
  await Promise.all(wanted.map(async ([path, isHtml]) => {
    const data = await grab(`${base}/${path}`, isHtml);
    if (data) files[`${skill.project_id}/${path}`] = data;
  }));
  if (Object.keys(files).length === 0) throw new Error('nothing to download');

  const blob = new Blob([zipSync(files)], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${skill.project_id}_skill_pack.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return Object.keys(files).length;
}
