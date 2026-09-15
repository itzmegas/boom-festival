export function supportsWebGl(documentRoot: Document = document): boolean {
  const canvas = documentRoot.createElement("canvas");
  try {
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
