/** Keep custom avatars while using a neutral account icon in lists and pickers. */
export function participantAvatar(value?: string) {
  return value && value !== '🧸' ? value : '👤';
}
