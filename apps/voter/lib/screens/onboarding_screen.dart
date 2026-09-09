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
    icon: bcLock,
    headline: 'Your vote is private',
    body:
        'Your ballot is encrypted on your device before it ever leaves your '
        'phone.',
  ),
  _Slide(
    icon: bcShieldCheck,
    headline: 'Your vote is verifiable',
    body:
        'After voting, you get a code to confirm your vote was counted — '
        'without revealing your choice.',
  ),
  _Slide(
    icon: bcGlobe,
    headline: 'Anyone can check the results',
    body:
        'The entire election can be independently verified by anyone, at any '
        'time.',
  ),
];

/// Onboarding — three swipeable slides, page dots, and a Next / Get Started CTA.
/// "Skip" is offered on every slide but the last.
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
        duration: const Duration(milliseconds: 340),
        curve: Curves.easeOutCubic,
      );
    }
  }

  void _goToLogin() {
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const EmailLoginScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLast = _index == _slides.length - 1;
    return Scaffold(
      backgroundColor: BcColors.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            SizedBox(
              height: 44,
              child: Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: const EdgeInsets.only(right: BcSpace.sm),
                  child: isLast
                      ? const SizedBox(height: 20)
                      : BcTextButton(
                          label: 'Skip',
                          color: BcColors.text2,
                          onPressed: _goToLogin,
                        ),
                ),
              ),
            ),
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (i) => setState(() => _index = i),
                itemCount: _slides.length,
                itemBuilder: (context, i) => _SlideView(slide: _slides[i]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(BcSpace.md, 8, BcSpace.md, 30),
              child: Column(
                children: [
                  BcPageDots(count: _slides.length, current: _index),
                  const SizedBox(height: 26),
                  BcPrimaryButton(
                    label: isLast ? 'Get Started' : 'Next',
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
      padding: const EdgeInsets.fromLTRB(32, 12, 32, 0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 132,
            height: 132,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: BcColors.tealLight,
              borderRadius: BorderRadius.circular(40),
            ),
            child: Icon(slide.icon, size: 58, color: BcColors.teal),
          ),
          const SizedBox(height: 40),
          Text(
            slide.headline,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w700,
              color: BcColors.text1,
              height: 1.25,
            ),
          ),
          const SizedBox(height: 14),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 300),
            child: Text(
              slide.body,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: BcType.body,
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
