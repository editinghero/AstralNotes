/**
 * Share links are just an unguessable id: `/s/<id>`. The ciphertext lives in
 * D1, so a 100k-word note produces the same short URL, and the link alone is
 * useless without the share password.
 */
export function shareUrl(id: string, origin: string): string {
  return `${origin}/s/${id}`;
}
