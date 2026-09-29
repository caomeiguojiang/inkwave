// Explicit reactive text bindings for the native DOM UI. No string matching or DOM observer.
const bindings = new WeakMap();
export function setLocalizedText(node, render) {
  node.textContent = render();
  bindings.set(node, {render, property:'textContent', value:node.textContent});
}
export function setLocalizedHTML(node, render) {
  node.innerHTML = render();
  bindings.set(node, {render, property:'innerHTML', value:node.innerHTML});
}
export function refreshLocalized(root) {
  if (!root) return;
  const visit = node => {
    const binding = bindings.get(node);
    if (binding && node[binding.property] === binding.value) {
      node[binding.property] = binding.render();
      binding.value = node[binding.property];
    }
    for (const child of [...node.childNodes]) visit(child);
  };
  visit(root);
}
