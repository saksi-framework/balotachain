import 'package:flutter/material.dart';
import 'package:voter/data/bulletin_store.dart';
import 'package:voter/data/mock_candidates.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/vote_submitted_screen.dart';
import 'package:voter/services/encrypt_service.dart';
import 'package:voter/state/ballot.dart';

/// Review & confirm — one block per position, then the irreversibility warning
/// and the submit CTA. Submitting runs the real `balota-encrypt` shell-out.
class ReviewScreen extends StatefulWidget {
  const ReviewScreen({
    super.key,
    required this.selections,
    this.encryptService,
    this.bulletinStore,
  });

  final BallotSelections selections;

  /// Optional injection points for tests / non-default binary paths.
  final EncryptService? encryptService;
  final BulletinSource? bulletinStore;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  bool _submitting = false;
  String? _error;

  EncryptService get _service => widget.encryptService ?? EncryptService();
  BulletinSource get _store => widget.bulletinStore ?? bulletinSourceFromEnv();

  /// Demo voter identity for the one-voter staging cycle. Multi-voter support
  /// lives in a later Saksi iteration.
  static const String _demoVoterId = 'v-000001';

  Future<void> _onSubmit() async {
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final bulletin = await _store.load();
      if (bulletin['election'] == null) {
        _showError('No election available. Run the admin setup first.');
        return;
      }
      final credentials = (bulletin['credentials'] as List<dynamic>? ?? [])
          .whereType<Map<String, dynamic>>()
          .where((c) => c['voter_id'] == _demoVoterId)
          .toList();
      if (credentials.isEmpty) {
        _showError("You don't have a credential. Run the admin setup first.");
        return;
      }
      final token = credentials.first['token']?.toString() ?? '';
      if (token.isEmpty) {
        _showError('Credential token is missing or empty.');
        return;
      }

      final choice = packChoice(
        presidentIndex: _indexOrZero(
          mockPresidents,
          widget.selections.president,
        ),
        vpIndex: _indexOrZero(mockVicePresidents, widget.selections.vp),
        senatorCount: widget.selections.senators.length,
      );

      final result = await _service.submitBallot(
        voterId: _demoVoterId,
        token: token,
        choice: choice,
      );

      if (!mounted) return;
      await Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => VoteSubmittedScreen(trackingCode: result.trackingCode),
        ),
      );
    } on EncryptServiceException catch (e) {
      _showError('Submit failed: ${e.message}');
    } catch (e) {
      _showError('Submit failed: $e');
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    setState(() {
      _error = message;
      _submitting = false;
    });
  }

  static int _indexOrZero(List<Candidate> list, Candidate? c) {
    if (c == null) return 0;
    final idx = list.indexOf(c);
    return idx < 0 ? 0 : idx;
  }

  @override
  Widget build(BuildContext context) {
    final president = widget.selections.president;
    final vp = widget.selections.vp;
    final senators = widget.selections.senators;

    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: BcTopBar(
        title: 'Review your vote',
        onBack: () => Navigator.of(context).pop(),
      ),
      body: Column(
        children: [
          Expanded(
            child: BcBody(
              padTop: 2,
              children: [
                const Text(
                  'Confirm your choices before submitting.',
                  style: TextStyle(
                    fontSize: 14,
                    color: BcColors.text2,
                    height: BcType.lineHeight,
                  ),
                ),
                const SizedBox(height: 18),
                if (_error != null) ...[
                  _ErrorBanner(message: _error!),
                  const SizedBox(height: BcSpace.sm),
                ],
                if (president != null)
                  _ReviewBlock(
                    label: 'PRESIDENT',
                    children: [_ReviewRow(candidate: president, big: true)],
                  ),
                if (vp != null)
                  _ReviewBlock(
                    label: 'VICE PRESIDENT',
                    children: [_ReviewRow(candidate: vp, big: true)],
                  ),
                _ReviewBlock(
                  label: 'SENATORS',
                  count: '${senators.length} of ${BallotSelections.senatorsMax}',
                  children: senators.isEmpty
                      ? const [
                          Padding(
                            padding: EdgeInsets.symmetric(vertical: 12),
                            child: Text(
                              'No senators selected',
                              style: TextStyle(
                                fontSize: 14,
                                color: BcColors.text2,
                              ),
                            ),
                          ),
                        ]
                      : [
                          for (var i = 0; i < senators.length; i++)
                            DecoratedBox(
                              decoration: BoxDecoration(
                                border: i == 0
                                    ? null
                                    : const Border(
                                        top: BorderSide(
                                          color: BcColors.border,
                                        ),
                                      ),
                              ),
                              child: _ReviewRow(candidate: senators[i]),
                            ),
                        ],
                ),
                const SizedBox(height: 6),
                const _FinalityBanner(),
                const SizedBox(height: BcSpace.xs),
              ],
            ),
          ),
          BcFooter(
            child: Column(
              children: [
                BcPrimaryButton(
                  label: _submitting ? 'Submitting…' : 'Submit Vote',
                  onPressed: _submitting ? null : _onSubmit,
                ),
                const SizedBox(height: 12),
                BcSecondaryButton(
                  label: 'Go back',
                  onPressed: _submitting
                      ? null
                      : () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// One position's confirmed picks, under an uppercase label.
class _ReviewBlock extends StatelessWidget {
  const _ReviewBlock({
    required this.label,
    required this.children,
    this.count,
  });

  final String label;
  final List<Widget> children;
  final String? count;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: BcSpace.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: BcType.eyebrow,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: BcColors.text2,
                  height: 1.2,
                ),
              ),
              if (count != null)
                Text(
                  count!,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: BcColors.text2,
                    height: 1.2,
                  ),
                ),
            ],
          ),
          const SizedBox(height: BcSpace.xs),
          BcCard(
            flat: true,
            padding: const EdgeInsets.symmetric(
              horizontal: BcSpace.sm,
              vertical: BcSpace.xs,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.candidate, this.big = false});

  final Candidate candidate;
  final bool big;

  @override
  Widget build(BuildContext context) {
    final size = big ? 46.0 : 38.0;
    return Padding(
      padding: EdgeInsets.symmetric(vertical: big ? 2 : 9),
      child: Row(
        children: [
          Container(
            width: size,
            height: size,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: BcColors.teal,
              borderRadius: BorderRadius.circular(big ? 14 : 11),
            ),
            child: Text(
              bcInitials(candidate.name),
              style: TextStyle(
                fontSize: big ? 16 : 14,
                fontWeight: FontWeight.w600,
                color: BcColors.surface,
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  candidate.name,
                  style: TextStyle(
                    fontSize: big ? 17 : 15.5,
                    fontWeight: FontWeight.w600,
                    color: BcColors.text1,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  candidate.party,
                  style: const TextStyle(
                    fontSize: 13.5,
                    color: BcColors.text2,
                    height: 1.3,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(BcSpace.sm, 14, BcSpace.sm, 14),
      decoration: BoxDecoration(
        color: BcColors.errorLight,
        border: Border.all(color: BcColors.error, width: 1),
        borderRadius: BorderRadius.circular(BcRadii.button),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(bcAlert, size: 22, color: BcColors.error),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: 14.5,
                color: BcColors.error,
                fontWeight: FontWeight.w600,
                height: BcType.lineHeight,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FinalityBanner extends StatelessWidget {
  const _FinalityBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(BcSpace.sm, 14, BcSpace.sm, 14),
      decoration: BoxDecoration(
        color: BcColors.warnLight,
        border: Border.all(color: BcColors.warnBorder, width: 1),
        borderRadius: BorderRadius.circular(BcRadii.button),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(bcAlert, size: 22, color: BcColors.warn),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Once submitted, your vote is final and cannot be changed.',
              style: TextStyle(
                fontSize: 14.5,
                color: BcColors.warnText,
                height: BcType.lineHeight,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
