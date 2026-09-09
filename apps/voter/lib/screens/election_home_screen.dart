import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/ballot_screen.dart';

/// Election home — one active-election card and the Start Voting CTA.
class ElectionHomeScreen extends StatelessWidget {
  const ElectionHomeScreen({super.key});

  void _onCast(BuildContext context) {
    Navigator.of(
      context,
    ).push(MaterialPageRoute<void>(builder: (_) => const BallotScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: const BcTopBar(title: 'BalotaChain'),
      body: Column(
        children: [
          const Expanded(
            child: BcBody(
              padTop: 6,
              children: [
                _ActiveElectionEyebrow(),
                SizedBox(height: 12),
                _ElectionCard(),
              ],
            ),
          ),
          BcFooter(
            child: BcPrimaryButton(
              label: 'Start Voting',
              onPressed: () => _onCast(context),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActiveElectionEyebrow extends StatelessWidget {
  const _ActiveElectionEyebrow();

  @override
  Widget build(BuildContext context) {
    return const Row(
      children: [
        SizedBox(
          width: 8,
          height: 8,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: BcColors.success,
              shape: BoxShape.circle,
            ),
          ),
        ),
        SizedBox(width: BcSpace.xs),
        Text(
          'ACTIVE ELECTION',
          style: TextStyle(
            fontSize: BcType.eyebrow,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.6,
            color: BcColors.success,
            height: 1.2,
          ),
        ),
      ],
    );
  }
}

class _ElectionCard extends StatelessWidget {
  const _ElectionCard();

  @override
  Widget build(BuildContext context) {
    // The divider is full-bleed, so the card carries no padding of its own and
    // each band pads itself instead (22 all round, matching the mockup).
    return const BcCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(22, 22, 22, 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Philippine National Elections 2028',
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: BcColors.text1,
                    height: 1.3,
                  ),
                ),
                SizedBox(height: 14),
                Wrap(
                  spacing: BcSpace.sm,
                  runSpacing: BcSpace.xs,
                  children: [
                    _MetaChip(icon: bcShieldCheck, label: '3 positions'),
                    _MetaChip(icon: bcClock, label: 'Closes May 8'),
                  ],
                ),
              ],
            ),
          ),
          Divider(height: 1, thickness: 1, color: BcColors.border),
          Padding(
            padding: EdgeInsets.fromLTRB(22, 18, 22, 22),
            child: Text(
              "You'll vote for President, Vice President, and up to 12 "
              'Senators. It takes about a minute.',
              style: TextStyle(
                fontSize: 14,
                color: BcColors.text2,
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 17, color: BcColors.text2),
        const SizedBox(width: 6),
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            color: BcColors.text2,
            height: 1.3,
          ),
        ),
      ],
    );
  }
}
