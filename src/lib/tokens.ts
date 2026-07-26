export const tldTokens = {
  name: {
    label: '.name',
    role: 'Identity',
    pow: 'Personporträtt / bio / människa',
    accent: 'coral',
    accentHex: '#ff5c7a',
    softBg: '#fff1f4',
    textClass: 'text-coral',
    bgClass: 'bg-coral-soft',
    borderClass: 'border-coral',
  },
  cv: {
    label: '.cv',
    role: 'Capability',
    pow: 'Erfarenhet / skills / matchning',
    accent: 'mint',
    accentHex: '#12b981',
    softBg: '#ecfdf5',
    textClass: 'text-mint',
    bgClass: 'bg-mint-soft',
    borderClass: 'border-mint',
  },
} as const;

export type TldKey = keyof typeof tldTokens;
