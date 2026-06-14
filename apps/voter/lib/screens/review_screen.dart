import 'package:flutter/material.dart';
import 'package:voter/data/bulletin_store.dart';
import 'package:voter/data/mock_candidates.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/vote_submitted_screen.dart';
import 'package:voter/services/encrypt_service.dart';
import 'package:voter/state/ballot.dart';

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
  final BulletinStore? bulletinStore;

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  bool _submitting = false;
  String? _error;

  EncryptService get _service => widget.encryptService ?? EncryptService();
  BulletinStore get _store =>
      widget.bulletinStore ?? BulletinStore.atDefaultPath();

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
        presidentIndex:
            _indexOrZero(mockPresidents, widget.selections.president),
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
          builder: (_) =>
              VoteSubmittedScreen(trackingCode: result.trackingCode),
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
    return Scaffold(
      backgroundColor: BcColors.bg,
      appBar: BcTopBar(
        title: 'Review',
        onBack: () => Navigator.of(context).pop(),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(BcSpace.md),
                children: [
                  if (_error != null) ...[
                    _ErrorBanner(message: _error!),
                    const SizedBox(height: BcSpace.sm),
                  ],
                  const _FinalityBanner(),
                  const SizedBox(height: BcSpace.md),
                  _SectionCard(
                    title: 'President',
                    entries: <Candidate>[
                      if (widget.selections.president != null)
                        widget.selections.president!,
                    ],
                  ),
                  const SizedBox(height: BcSpace.sm),
                  _SectionCard(
                    title: 'Vice President',
                    entries: <Candidate>[
                      if (widget.selections.vp != null)
                        widget.selections.vp!,
                    ],
                  ),
                  const SizedBox(height: BcSpace.sm),
                  _SectionCard(
                    title: 'Senators',
                    entries: widget.selections.senators,
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(BcSpace.md),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  BcSecondaryButton(
                    label: 'Edit',
                    onPressed: _submitting
                        ? null
                        : () => Navigator.of(context).pop(),
                  ),
                  BcPrimaryButton(
                    label: _submitting ? 'Submitting...' : 'Submit my ballot',
                    onPressed: _submitting ? null : _onSubmit,
                  ),
                ],
              ),
            ),
          ],
        ),
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
      padding: const EdgeInsets.all(BcSpace.sm),
      decoration: BoxDecoration(
        color: BcColors.error.withValues(alpha: 0.08),
        border: Border.all(color: BcColors.error, width: 1),
        borderRadius: BorderRadius.circular(BcRadii.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(bcAlert, size: 20, color: BcColors.error),
          const SizedBox(width: BcSpace.sm),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: BcType.body,
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
      padding: const EdgeInsets.all(BcSpace.sm),
      decoration: BoxDecoration(
        color: BcColors.warn.withValues(alpha: 0.08),
        border: Border.all(color: BcColors.warn, width: 1),
        borderRadius: BorderRadius.circular(BcRadii.card),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Icon(bcAlert, size: 20, color: BcColors.warn),
          SizedBox(width: BcSpace.sm),
          Expanded(
            child: Text(
              'Once submitted, your ballot cannot be changed.',
              style: TextStyle(
                fontSize: BcType.body,
                color: BcColors.warn,
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

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.entries});

  final String title;
  final List<Candidate> entries;

  @override
  Widget build(BuildContext context) {
    return BcCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: BcType.body,
              fontWeight: FontWeight.w700,
              color: BcColors.text1,
              height: BcType.lineHeight,
            ),
          ),
          const SizedBox(height: BcSpace.xs),
          if (entries.isEmpty)
            const Text(
              'No selection',
              style: TextStyle(
                fontSize: BcType.body,
                color: BcColors.text2,
                height: BcType.lineHeight,
              ),
            )
          else
            for (final c in entries)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        c.name,
                        style: const TextStyle(
                          fontSize: BcType.body,
                          fontWeight: FontWeight.w600,
                          color: BcColors.text1,
                          height: BcType.lineHeight,
                        ),
                      ),
                    ),
                    Text(
                      c.party,
                      style: const TextStyle(
                        fontSize: BcType.body,
                        color: BcColors.text2,
                        height: BcType.lineHeight,
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
