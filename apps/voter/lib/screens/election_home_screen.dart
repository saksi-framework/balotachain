import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/ballot_screen.dart';

class ElectionHomeScreen extends StatelessWidget {
  const ElectionHomeScreen({super.key});

  static const List<String> _positions = <String>[
    'President',
    'Vice President',
    'Senators (up to 12)',
  ];

  void _onCast(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(builder: (_) => const BallotScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: const BcTopBar(title: 'Elections'),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(BcSpace.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              BcCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Philippine National Elections 2028',
                      style: TextStyle(
                        fontSize: BcType.h2,
                        fontWeight: FontWeight.w700,
                        color: BcColors.text1,
                        height: BcType.lineHeight,
                      ),
                    ),
                    const SizedBox(height: BcSpace.sm),
                    for (final p in _positions) _PositionRow(label: p),
                  ],
                ),
              ),
              const Spacer(),
              BcPrimaryButton(
                label: 'Cast my ballot',
                fullWidth: true,
                onPressed: () => _onCast(context),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PositionRow extends StatelessWidget {
  const _PositionRow({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: BcSpace.xs),
      child: Row(
        children: [
          const Icon(bcCheck, size: 20, color: BcColors.text2),
          const SizedBox(width: BcSpace.sm),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                fontSize: BcType.body,
                color: BcColors.text1,
                height: BcType.lineHeight,
              ),
            ),
          ),
          const Icon(bcChevron, size: 20, color: BcColors.text2),
        ],
      ),
    );
  }
}
