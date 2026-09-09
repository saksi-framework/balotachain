import 'package:voter/state/ballot.dart';

// Demo slate, matching the Claude Design voter mockup (and the same election
// the auditor's bulletin board reports on). Order is load-bearing: the index
// into these lists is what `packChoice` encodes into the ballot.

const List<Candidate> mockPresidents = <Candidate>[
  Candidate(name: 'Andrea Reyes', party: 'Lakas ng Bayan'),
  Candidate(name: 'Marco Villanueva', party: 'Tatak Galing Party'),
  Candidate(name: 'Joy delos Santos', party: 'Bagong Pilipinas'),
  Candidate(name: 'Rashid Hassan', party: 'Independent'),
];

const List<Candidate> mockVicePresidents = <Candidate>[
  Candidate(name: 'Camille Aquino', party: 'Lakas ng Bayan'),
  Candidate(name: 'Benigno Torres', party: 'Tatak Galing Party'),
  Candidate(name: 'Liza Mangahas', party: 'Bagong Pilipinas'),
  Candidate(name: 'Omar Pangilinan', party: 'Independent'),
];

const List<Candidate> mockSenators = <Candidate>[
  Candidate(name: 'Grace Bautista', party: 'Lakas ng Bayan'),
  Candidate(name: 'Ramon Cuevas', party: 'Tatak Galing Party'),
  Candidate(name: 'Isabel Navarro', party: 'Independent'),
  Candidate(name: 'Teodoro Lim', party: 'Bagong Pilipinas'),
  Candidate(name: 'Farida Macaraeg', party: 'Lakas ng Bayan'),
  Candidate(name: 'Vicente Ocampo', party: 'Independent'),
  Candidate(name: 'Dolores Salazar', party: 'Tatak Galing Party'),
  Candidate(name: 'Nestor Aguilar', party: 'Bagong Pilipinas'),
  Candidate(name: 'Pilar Fuentes', party: 'Independent'),
  Candidate(name: 'Ernesto Dimaano', party: 'Lakas ng Bayan'),
  Candidate(name: 'Cherry Mae Lacson', party: 'Tatak Galing Party'),
  Candidate(name: 'Alfonso Rivera', party: 'Independent'),
  Candidate(name: 'Maria Concepcion Yap', party: 'Bagong Pilipinas'),
  Candidate(name: 'Gregorio Panganiban', party: 'Lakas ng Bayan'),
];
