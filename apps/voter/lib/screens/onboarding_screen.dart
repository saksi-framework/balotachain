import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/email_login_screen.dart';

class _Slide {
  const _Slide({
    required this.icon,
    required this.headline,
    required this.body,
  });

  final IconData icon;
  final String headline;
  final String body;
}

const List<_Slide> _slides = <_Slide>[
  _Slide(
    icon: bcShieldCheck,
    headline: 'Your vote is private',
    body:
        'End-to-end encrypted. Nobody can see your ballot — not even us.',
  ),
  _Slide(
    icon: bcCheck,
    headline: 'Your vote is verifiable',
    body: 'Confirm your ballot was recorded on the public bulletin.',
  ),
  _Slide(
    icon: bcGlobe,
    headline: 'Anyone can verify',
    body: 'Anyone can re-derive the tally and audit the election.',
  ),
];

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _index = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onContinue() {
    if (_index == _slides.length - 1) {
      _goToLogin();
    } else {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOut,
      );
    }
  }

  void _goToLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => const EmailLoginScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    return Scaffold(
      backgroundColor: BcColors.bg,
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _index = i),
                itemCount: _slides.length,
                itemBuilder: (context, i) => _SlideView(slide: _slides[i]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: BcSpace.md),
              child: BcPageDots(count: _slides.length, current: _index),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                BcSpace.md,
                0,
                BcSpace.md,
                BcSpace.md,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  BcTextButton(label: 'Skip', onPressed: _goToLogin),
                  BcPrimaryButton(
                    label: isLast ? 'Get started' : 'Continue',
                    onPressed: _onContinue,
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

class _SlideView extends StatelessWidget {
  const _SlideView({required this.slide});

  final _Slide slide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: BcSpace.md),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 96,
            height: 96,
            decoration: const BoxDecoration(
              color: BcColors.tealLight,
              shape: BoxShape.circle,
            ),
            child: Icon(slide.icon, size: 48, color: BcColors.teal),
          ),
          const SizedBox(height: BcSpace.lg),
          Text(
            slide.headline,
            style: const TextStyle(
              fontSize: BcType.h1,
              fontWeight: FontWeight.w700,
              color: BcColors.text1,
              height: BcType.lineHeight,
            ),
          ),
          const SizedBox(height: BcSpace.sm),
          Text(
            slide.body,
            style: const TextStyle(
              fontSize: BcType.body,
              color: BcColors.text2,
              height: BcType.lineHeight,
            ),
          ),
        ],
      ),
    );
  }
}
