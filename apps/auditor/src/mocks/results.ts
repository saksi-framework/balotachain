// Demo data for the bulletin board, mirroring the Claude Design mockup
// (`.design-src/bulletin-board.html`). Replaced at runtime by the real tally
// as soon as `loadBulletin()` returns one.

export type Candidate = {
  name: string;
  party?: string;
  votes: number;
  elected?: boolean;
  /** Shown instead of a percentage in multi-seat races, e.g. "#1". */
  rank?: string;
};

export type Race = {
  title: string;
  /** "1 seat" / "12 seats", right-aligned in the race header. */
  seatLabel: string;
  subtitle: string;
  pickLimit: number;
  ballotsTotal: number;
  candidates: Candidate[];
  footnote?: string;
};

const PRESIDENT: Race = {
  title: "President",
  seatLabel: "1 seat",
  subtitle: "12,488,302 votes counted",
  pickLimit: 1,
  ballotsTotal: 12488302,
  candidates: [
    {
      name: "Andrea Reyes",
      party: "Lakas ng Bayan",
      votes: 5341887,
      elected: true,
    },
    { name: "Marco Villanueva", party: "Tatak Galing", votes: 4102556 },
    { name: "Joy delos Santos", party: "Bagong Pilipinas", votes: 2210019 },
    { name: "Rashid Hassan", party: "Independent", votes: 833840 },
  ],
};

const VICE_PRESIDENT: Race = {
  title: "Vice President",
  seatLabel: "1 seat",
  subtitle: "12,301,744 votes counted",
  pickLimit: 1,
  ballotsTotal: 12301744,
  candidates: [
    {
      name: "Camille Aquino",
      party: "Lakas ng Bayan",
      votes: 4920698,
      elected: true,
    },
    { name: "Benigno Torres", party: "Tatak Galing", votes: 4556002 },
    { name: "Liza Mangahas", party: "Bagong Pilipinas", votes: 1968279 },
    { name: "Omar Pangilinan", party: "Independent", votes: 856765 },
  ],
};

const SENATOR: Race = {
  title: "Senator",
  seatLabel: "12 seats",
  subtitle: "Top 12 of 37 candidates elected",
  pickLimit: 12,
  ballotsTotal: 12488302,
  candidates: [
    { name: "Grace Bautista", votes: 8114200, elected: true, rank: "#1" },
    { name: "Isabel Navarro", votes: 7902551, elected: true, rank: "#2" },
    { name: "Ramon Cuevas", votes: 7488019, elected: true, rank: "#3" },
    { name: "Teodoro Lim", votes: 5102884, rank: "#13" },
  ],
  footnote: "Showing the top 3 of 12 elected senators.",
};

export const RACES: Race[] = [PRESIDENT, VICE_PRESIDENT, SENATOR];

export const ELECTION_NAME = "Philippine National Elections 2028";
export const TALLY_SHA256 =
  "9f3a7c2e8b1d4056af92e7c0d3b618fe4a2c9d70e15b8843f6a0c2e9b71d4f88";

export const BALLOTS_CAST = 12613540;
export const BALLOTS_VERIFIED = 12611219;
export const BALLOTS_REJECTED = 2321;
export const PRECINCTS = 38204;
export const REGISTERED_VOTERS = 17665000;
export const TURNOUT = 71.4;

export const TRUSTEES_SIGNED = 3;
export const TRUSTEES_TOTAL = 5;
export const POLLS_CLOSED_AT = "May 8, 2028 · 7:00 PM PHT";
export const TALLY_PUBLISHED_AT = "May 8, 2028 · 9:42 PM";
export const SAMPLE_VOTE_RECORDED_AT = "May 8, 2028 · 6:14 PM PHT";
