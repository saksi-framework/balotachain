export type Candidate = {
  name: string;
  party: string;
  votes: number;
  elected?: boolean;
};

export type Race = {
  title: string;
  subtitle?: string;
  pickLimit: number;
  ballotsTotal: number;
  candidates: Candidate[];
};

const PRESIDENT: Race = {
  title: 'President',
  pickLimit: 1,
  ballotsTotal: 1247,
  candidates: [
    { name: 'Maria Santos', party: 'Lakas–CMD', votes: 612, elected: true },
    { name: 'Juan Dela Cruz', party: 'Independent', votes: 318 },
    { name: 'Andres Bonifacio', party: 'PDP–Laban', votes: 201 },
    { name: 'Gabriela Silang', party: 'Akbayan', votes: 116 },
  ],
};

const VICE_PRESIDENT: Race = {
  title: 'Vice President',
  pickLimit: 1,
  ballotsTotal: 1247,
  candidates: [
    { name: 'Jose Rizal', party: 'Independent', votes: 542, elected: true },
    { name: 'Apolinario Mabini', party: 'Aksyon', votes: 311 },
    { name: 'Melchora Aquino', party: 'Liberal', votes: 250 },
    { name: 'Diego Silang', party: 'PDP–Laban', votes: 144 },
  ],
};

const SENATORS: Race = {
  title: 'Senators — top 12 elected',
  subtitle: '12 of 14 candidates elected.',
  pickLimit: 12,
  ballotsTotal: 1247,
  candidates: [
    { name: 'Emilio Aguinaldo', party: 'Lakas–CMD', votes: 1182, elected: true },
    { name: 'Corazon Aquino', party: 'Liberal', votes: 1147, elected: true },
    { name: 'Manuel Quezon', party: 'Nacionalista', votes: 1098, elected: true },
    { name: 'Lapu-Lapu', party: 'Independent', votes: 1056, elected: true },
    { name: 'Sergio Osmeña', party: 'Nacionalista', votes: 1021, elected: true },
    { name: 'Manuel Roxas', party: 'Liberal', votes: 994, elected: true },
    { name: 'Elpidio Quirino', party: 'Liberal', votes: 962, elected: true },
    { name: 'Ramon Magsaysay', party: 'Nacionalista', votes: 941, elected: true },
    { name: 'Carlos Garcia', party: 'Nacionalista', votes: 908, elected: true },
    { name: 'Diosdado Macapagal', party: 'Liberal', votes: 884, elected: true },
    { name: 'Ferdinand Marcos', party: 'KBL', votes: 851, elected: true },
    { name: 'Benigno Aquino', party: 'Liberal', votes: 812, elected: true },
    { name: 'Teodora Alonzo', party: 'Akbayan', votes: 477 },
    { name: 'Marcela Agoncillo', party: 'Independent', votes: 412 },
  ],
};

export const RACES: Race[] = [PRESIDENT, VICE_PRESIDENT, SENATORS];

export const TALLY_SHA256 =
  '9b1c4f8a2e6d7d44ab3271f02c8e5a91b6d3e7c0f184a229b5c768d019e4f3a1';

export const BALLOTS_CAST = 1247;
export const TRUSTEES_SIGNED = 3;
export const TRUSTEES_TOTAL = 5;
export const POLLS_CLOSED_AT = '2026-06-08 23:59 PHT';
export const SAMPLE_VOTE_RECORDED_AT = '2026-06-08 21:14 PHT';
export const ENCRYPTION_SCHEME = 'ElGamal + additive homomorphism';
