import 'package:flutter/material.dart';
import 'package:voter/data/mock_candidates.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/review_screen.dart';
import 'package:voter/state/ballot.dart';

/// One step of the ballot: a position, how many may be picked, and its slate.
class _Race {
  const _Race({
    required this.label,
    required this.pick,
    required this.candidates,
  });

  final String label;
  final int pick;
  final List<Candidate> candidates;
}

const List<_Race> _races = <_Race>[
  _Race(label: 'President', pick: 1, candidates: mockPresidents),
  _Race(label: 'Vice President', pick: 1, candidates: mockVicePresidents),
  _Race(
    label: 'Senators',
    pick: BallotSelections.senatorsMax,
    candidates: mockSenators,
  ),
];

/// Ballot — three stepped positions with a segmented progress bar. Back on the
/// first step leaves the ballot; the last step advances to review.
class BallotScreen extends StatefulWidget {
  const BallotScreen({super.key});

  @override
  State<BallotScreen> createState() => _BallotScreenState();
}

class _BallotScreenState extends State<BallotScreen> {
  final BallotSelections _selections = BallotSelections();
  int _step = 0;

  void _next() {
    if (_step < _races.length - 1) {
      setState(() => _step += 1);
    } else {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => ReviewScreen(selections: _selections),
        ),
      );
    }
  }

  void _back() {
    if (_step > 0) {
      setState(() => _step -= 1);
    } else {
      Navigator.of(context).pop();
    }
  }

  void _pick(Candidate c) {
    setState(() {
      if (_step == 0) {
        _selections.president = c;
      } else if (_step == 1) {
        _selections.vp = c;
      } else if (_selections.senators.contains(c)) {
        _selections.senators = List<Candidate>.from(_selections.senators)
          ..remove(c);
      } else if (!_selections.isAtSenatorCap) {
        _selections.senators = List<Candidate>.from(_selections.senators)
          ..add(c);
      }
    });
  }

  bool _isSelected(Candidate c) {
    if (_step == 0) return _selections.president == c;
    if (_step == 1) return _selections.vp == c;
    return _selections.senators.contains(c);
  }

  /// How many picks the voter has made on the current step.
  int get _count {
    if (_step == 0) return _selections.president == null ? 0 : 1;
    if (_step == 1) return _selections.vp == null ? 0 : 1;
    return _selections.senators.length;
  }

  @override
  Widget build(BuildContext context) {
    final race = _races[_step];
    final single = race.pick == 1;
    final atCap = !single && _count >= race.pick;
    final isLast = _step == _races.length - 1;

    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: BcTopBar(title: race.label, onBack: _back),
      body: Column(
        children: [
          _ProgressHeader(
            step: _step,
            total: _races.length,
            countLabel: single
                ? 'Choose one'
                : '$_count of ${race.pick} selected',
            countColor: single
                ? BcColors.text2
                : (atCap ? BcColors.warn : BcColors.teal),
          ),
          Expanded(
            child: BcBody(
              padTop: 12,
              children: [
                BcRise(
                  key: ValueKey<int>(_step),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (final c in race.candidates) ...[
                        BcOptionCard(
                          label: c.name,
                          description: c.party,
                          selected: _isSelected(c),
                          multi: !single,
                          disabled: atCap && !_isSelected(c),
                          onTap: () => _pick(c),
                        ),
                        const SizedBox(height: 12),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          BcFooter(
            child: BcPrimaryButton(
              label: isLast ? 'Review' : 'Next',
              onPressed: _count >= 1 ? _next : null,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgressHeader extends StatelessWidget {
  const _ProgressHeader({
    required this.step,
    required this.total,
    required this.countLabel,
    required this.countColor,
  });

  final int step;
  final int total;
  final String countLabel;
  final Color countColor;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(BcSpace.md, 0, BcSpace.md, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              for (var i = 0; i < total; i++) ...[
                if (i > 0) const SizedBox(width: 6),
                Expanded(
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    height: 5,
                    decoration: BoxDecoration(
                      color: i <= step ? BcColors.teal : BcColors.border,
                      borderRadius: BorderRadius.circular(BcRadii.pill),
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'POSITION ${step + 1} OF $total',
                style: const TextStyle(
                  fontSize: BcType.eyebrow,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: BcColors.text2,
                  height: 1.2,
                ),
              ),
              Text(
                countLabel,
                style: TextStyle(
                  fontSize: BcType.eyebrow,
                  fontWeight: FontWeight.w600,
                  color: countColor,
                  height: 1.2,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
