import 'package:flutter/foundation.dart';

@immutable
class Candidate {
  const Candidate({required this.name, required this.party});

  final String name;
  final String party;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Candidate && other.name == name && other.party == party;

  @override
  int get hashCode => Object.hash(name, party);
}

typedef President = Candidate;
typedef Senator = Candidate;

class BallotSelections {
  BallotSelections({
    this.president,
    this.vp,
    List<Senator>? senators,
  }) : senators = senators ?? <Senator>[];

  President? president;
  President? vp;
  List<Senator> senators;

  static const int senatorsMax = 12;

  bool get isAtSenatorCap => senators.length >= senatorsMax;
}
