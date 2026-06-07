// Team identity: flag emoji + kit colors, keyed by the Spanish names used in the seed.
// c1/c2 drive the gradient accents; `abbr` is a 3-letter code for compact/mobile views.
export interface Team {
  flag: string
  c1: string // primary kit color
  c2: string // secondary kit color
  abbr: string
}

export const TEAMS: Record<string, Team> = {
  // Group A
  'México': { flag: '🇲🇽', c1: '#006847', c2: '#ce1126', abbr: 'MEX' },
  'Corea del Sur': { flag: '🇰🇷', c1: '#c60c30', c2: '#003478', abbr: 'KOR' },
  'Sudáfrica': { flag: '🇿🇦', c1: '#007749', c2: '#ffb612', abbr: 'RSA' },
  'Chequia': { flag: '🇨🇿', c1: '#11457e', c2: '#d7141a', abbr: 'CZE' },
  // Group B
  'Canadá': { flag: '🇨🇦', c1: '#ff0000', c2: '#b3b3b3', abbr: 'CAN' },
  'Suiza': { flag: '🇨🇭', c1: '#d52b1e', c2: '#ffffff', abbr: 'SUI' },
  'Catar': { flag: '🇶🇦', c1: '#8a1538', c2: '#ffffff', abbr: 'QAT' },
  'Bosnia y Herzegovina': { flag: '🇧🇦', c1: '#002395', c2: '#ffec00', abbr: 'BIH' },
  // Group C
  'Brasil': { flag: '🇧🇷', c1: '#ffdf00', c2: '#009c3b', abbr: 'BRA' },
  'Marruecos': { flag: '🇲🇦', c1: '#c1272d', c2: '#006233', abbr: 'MAR' },
  'Escocia': { flag: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', c1: '#0065bf', c2: '#ffffff', abbr: 'SCO' },
  'Haití': { flag: '🇭🇹', c1: '#00209f', c2: '#d21034', abbr: 'HAI' },
  // Group D
  'Estados Unidos': { flag: '🇺🇸', c1: '#0a3161', c2: '#b31942', abbr: 'USA' },
  'Australia': { flag: '🇦🇺', c1: '#00843d', c2: '#ffcd00', abbr: 'AUS' },
  'Paraguay': { flag: '🇵🇾', c1: '#d52b1e', c2: '#0038a8', abbr: 'PAR' },
  'Turquía': { flag: '🇹🇷', c1: '#e30a17', c2: '#ffffff', abbr: 'TUR' },
  // Group E
  'Alemania': { flag: '🇩🇪', c1: '#000000', c2: '#dd0000', abbr: 'GER' },
  'Ecuador': { flag: '🇪🇨', c1: '#ffdd00', c2: '#034ea2', abbr: 'ECU' },
  'Costa de Marfil': { flag: '🇨🇮', c1: '#f77f00', c2: '#009e60', abbr: 'CIV' },
  'Curazao': { flag: '🇨🇼', c1: '#002b7f', c2: '#f9d616', abbr: 'CUW' },
  // Group F
  'Países Bajos': { flag: '🇳🇱', c1: '#ff6c00', c2: '#21468b', abbr: 'NED' },
  'Japón': { flag: '🇯🇵', c1: '#002395', c2: '#bc002d', abbr: 'JPN' },
  'Túnez': { flag: '🇹🇳', c1: '#e70013', c2: '#ffffff', abbr: 'TUN' },
  'Suecia': { flag: '🇸🇪', c1: '#006aa7', c2: '#fecc00', abbr: 'SWE' },
  // Group G
  'Bélgica': { flag: '🇧🇪', c1: '#e30613', c2: '#f3d02f', abbr: 'BEL' },
  'Irán': { flag: '🇮🇷', c1: '#239f40', c2: '#da0000', abbr: 'IRN' },
  'Egipto': { flag: '🇪🇬', c1: '#ce1126', c2: '#000000', abbr: 'EGY' },
  'Nueva Zelanda': { flag: '🇳🇿', c1: '#1b1b1b', c2: '#ffffff', abbr: 'NZL' },
  // Group H
  'España': { flag: '🇪🇸', c1: '#c60b1e', c2: '#ffc400', abbr: 'ESP' },
  'Uruguay': { flag: '🇺🇾', c1: '#5cabe2', c2: '#1a3668', abbr: 'URU' },
  'Arabia Saudita': { flag: '🇸🇦', c1: '#006c35', c2: '#ffffff', abbr: 'KSA' },
  'Cabo Verde': { flag: '🇨🇻', c1: '#003893', c2: '#cf2027', abbr: 'CPV' },
  // Group I
  'Francia': { flag: '🇫🇷', c1: '#002654', c2: '#ed2939', abbr: 'FRA' },
  'Senegal': { flag: '🇸🇳', c1: '#00853f', c2: '#fdef42', abbr: 'SEN' },
  'Noruega': { flag: '🇳🇴', c1: '#ba0c2f', c2: '#00205b', abbr: 'NOR' },
  'Irak': { flag: '🇮🇶', c1: '#007a3d', c2: '#ce1126', abbr: 'IRQ' },
  // Group J
  'Argentina': { flag: '🇦🇷', c1: '#6cace4', c2: '#f6b40e', abbr: 'ARG' },
  'Austria': { flag: '🇦🇹', c1: '#ed2939', c2: '#ffffff', abbr: 'AUT' },
  'Argelia': { flag: '🇩🇿', c1: '#006633', c2: '#d21034', abbr: 'ALG' },
  'Jordania': { flag: '🇯🇴', c1: '#007a3d', c2: '#ce1126', abbr: 'JOR' },
  // Group K
  'Portugal': { flag: '🇵🇹', c1: '#006600', c2: '#ff0000', abbr: 'POR' },
  'Colombia': { flag: '🇨🇴', c1: '#fcd116', c2: '#003893', abbr: 'COL' },
  'Uzbekistán': { flag: '🇺🇿', c1: '#1eb53a', c2: '#0099b5', abbr: 'UZB' },
  'RD Congo': { flag: '🇨🇩', c1: '#007fff', c2: '#f7d618', abbr: 'COD' },
  // Group L
  'Inglaterra': { flag: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', c1: '#cf081f', c2: '#1d3a8a', abbr: 'ENG' },
  'Croacia': { flag: '🇭🇷', c1: '#d10000', c2: '#1d3a8a', abbr: 'CRO' },
  'Panamá': { flag: '🇵🇦', c1: '#db0a16', c2: '#005293', abbr: 'PAN' },
  'Ghana': { flag: '🇬🇭', c1: '#006b3f', c2: '#fcd116', abbr: 'GHA' },
}

const FALLBACK: Team = { flag: '🏳️', c1: '#3a3f4b', c2: '#5a606e', abbr: '???' }

// Safe accessor — unknown/placeholder names (e.g. "Por definir") get a neutral chip.
export function getTeam(name?: string | null): Team {
  if (!name) return FALLBACK
  return TEAMS[name] ?? { ...FALLBACK, abbr: name.slice(0, 3).toUpperCase() }
}
