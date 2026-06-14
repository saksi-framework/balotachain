import 'package:flutter/material.dart';
import 'package:voter/data/mock_candidates.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/review_screen.dart';
import 'package:voter/state/ballot.dart';

class BallotScreen extends StatefulWidget {
  const BallotScreen({super.key});

  @override
  State<BallotScreen> createState() => _BallotScreenState();
}

class _BallotScreenState extends State<BallotScreen> {
  final BallotSelections _selections = BallotSelections();
  int _step = 0;

  void _next() {
    if (_step < 2) {
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

  void _pickPresident(Candidate c) {
    setState(() => _selections.president = c);
  }

  void _pickVp(Candidate c) {
    setState(() => _selections.vp = c);
  }

  void _toggleSenator(Candidate c) {
    setState(() {
      if (_selections.senators.contains(c)) {
        _selections.senators = List<Candidate>.from(_selections.senators)
          ..remove(c);
      } else if (!_selections.isAtSenatorCap) {
        _selections.senators = List<Candidate>.from(_selections.senators)..add(c);
      }
    });
  }

  bool get _canAdvance {
    switch (_step) {
      case 0:
        return _selections.president != null;
      case 1:
        return _selections.vp != null;
      case 2:
        return _selections.senators.isNotEmpty;
      default:
        return false;
    }
  }

  String get _nextLabel => _step == 2 ? 'Review' : 'Next';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: BcTopBar(title: 'Ballot', onBack: _back),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(child: _buildStep()),
            Padding(
              padding: const EdgeInsets.all(BcSpace.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  BcSecondaryButton(label: 'Back', onPressed: _back),
                  BcPrimaryButton(
                    label: _nextLabel,
                    onPressed: _canAdvance ? _next : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStep() {
    switch (_step) {
      case 0:
        return _SingleStep(
          stepLabel: 'Step 1 of 3 - President',
          subtitle: 'Pick 1',
          candidates: mockPresidents,
          selected: _selections.president,
          onPick: _pickPresident,
        );
      case 1:
        return _SingleStep(
          stepLabel: 'Step 2 of 3 - Vice President',
          subtitle: 'Pick 1',
          candidates: mockVicePresidents,
          selected: _selections.vp,
          onPick: _pickVp,
        );
      case 2:
        return _SenatorStep(
          candidates: mockSenators,
          selected: _selections.senators,
          onToggle: _toggleSenator,
        );
      default:
        return const SizedBox.shrink();
    }
  }
}

class _StepHeader extends StatelessWidget {
  const _StepHeader({required this.stepLabel, required this.subtitle});

  final String stepLabel;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          stepLabel,
          style: const TextStyle(
            fontSize: BcType.body,
            fontWeight: FontWeight.w600,
            color: BcColors.text1,
            height: BcType.lineHeight,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: BcType.body,
            color: BcColors.text2,
            height: BcType.lineHeight,
          ),
        ),
      ],
    );
  }
}

class _SingleStep extends StatelessWidget {
  const _SingleStep({
    required this.stepLabel,
    required this.subtitle,
    required this.candidates,
    required this.selected,
    required this.onPick,
  });

  final String stepLabel;
  final String subtitle;
  final List<Candidate> candidates;
  final Candidate? selected;
  final ValueChanged<Candidate> onPick;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(BcSpace.md),
      children: [
        _StepHeader(stepLabel: stepLabel, subtitle: subtitle),
        const SizedBox(height: BcSpace.md),
        for (final c in candidates) ...[
          BcOptionCard(
            label: c.name,
            description: c.party,
            selected: c == selected,
            onTap: () => onPick(c),
          ),
          const SizedBox(height: BcSpace.xs),
        ],
      ],
    );
  }
}

class _SenatorStep extends StatelessWidget {
  const _SenatorStep({
    required this.candidates,
    required this.selected,
    required this.onToggle,
  });

  final List<Candidate> candidates;
  final List<Candidate> selected;
  final ValueChanged<Candidate> onToggle;

  @override
  Widget build(BuildContext context) {
    final atCap = selected.length >= BallotSelections.senatorsMax;
    return ListView(
      padding: const EdgeInsets.all(BcSpace.md),
      children: [
        _StepHeader(
          stepLabel: 'Step 3 of 3 - Senators',
          subtitle:
              'Pick up to ${BallotSelections.senatorsMax} (${selected.length} of ${BallotSelections.senatorsMax})',
        ),
        const SizedBox(height: BcSpace.md),
        for (final c in candidates) ...[
          BcOptionCard(
            label: c.name,
            description: c.party,
            selected: selected.contains(c),
            multi: true,
            disabled: atCap && !selected.contains(c),
            onTap: () => onToggle(c),
          ),
          const SizedBox(height: BcSpace.xs),
        ],
      ],
    );
  }
}
