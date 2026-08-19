export function getImageURL(image) {
  return new URL(`../assets/images/user/${image}`, import.meta.url).href;
}

export function getProdImageURL(image) {
  return new URL(`../assets/images/product/${image}`, import.meta.url).href;
}
