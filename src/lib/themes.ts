export const themes = {
  bear: {
    label: '小熊陪伴',
    icon: '/brand/tallybear-192.png',
    name: 'TallyBear',
    assistant: '小熊对话',
    color: '#f2efed',
    manifest: '/manifest.webmanifest',
  },
  minimal: {
    label: '极简清爽',
    icon: '/ledger-minimal.svg',
    name: 'TallyBear',
    assistant: '智能对话',
    color: '#eef0ef',
    manifest: '/manifest-minimal.webmanifest',
  },
} as const;
export type Theme = keyof typeof themes;
export function validTheme(value: unknown): Theme {
  return value === 'minimal' ? 'minimal' : 'bear';
}
