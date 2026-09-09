import 'package:flutter/material.dart';

/// Mirror of `packages/ui/src/tokens.ts` — keep both in sync.
class BcColors {
  static const teal = Color(0xFF0F6E6E);
  static const tealDark = Color(0xFF0A5252);
  static const tealLight = Color(0xFFE3F1F1);

  /// Border of teal-light pills/badges.
  static const tealBorder = Color(0xFFC5E0E0);
  static const bg = Color(0xFFFAFAF8);
  static const surface = Color(0xFFFFFFFF);
  static const text1 = Color(0xFF1A2526);
  static const text2 = Color(0xFF5C6B6B);
  static const success = Color(0xFF2E7D5B);
  static const successLight = Color(0xFFE6F2EC);
  static const successBorder = Color(0xFFC2E1D1);

  /// Heading colour inside success surfaces.
  static const successText = Color(0xFF1E5A40);

  /// Body copy inside success surfaces.
  static const successBody = Color(0xFF2E5C49);
  static const warn = Color(0xFFC8851A);
  static const warnLight = Color(0xFFFBF3E2);
  static const warnBorder = Color(0xFFEFD9A9);
  static const warnText = Color(0xFF835B12);
  static const error = Color(0xFFC0392B);
  static const errorLight = Color(0xFFF7E8E6);
  static const border = Color(0xFFE0E4E3);

  /// Border on hover/press for outlined controls.
  static const borderHover = Color(0xFFC9D0CE);

  /// Neutral track/avatar fill (bars, unselected avatars, disabled buttons).
  static const neutralFill = Color(0xFFEEF1F0);

  /// Muted teal for non-leading result bars.
  static const neutralBar = Color(0xFF9FBFBF);

  /// Placeholder text and offline dots.
  static const muted = Color(0xFF9AA6A5);
}

class BcRadii {
  static const card = 16.0;
  static const button = 12.0;
  static const pill = 9999.0;
}

class BcSpace {
  static const xs = 8.0;
  static const sm = 16.0;
  static const md = 24.0;
  static const lg = 32.0;
}

class BcType {
  static const body = 16.0;
  static const h1 = 28.0;
  static const h2 = 24.0;
  static const h3 = 20.0;

  /// Uppercase section eyebrow / card label.
  static const eyebrow = 13.0;
  static const small = 13.0;
  static const button = 18.0;
  static const lineHeight = 1.5;
  static const mono = 'monospace';
}

class BcShadows {
  static const card = [
    BoxShadow(
      color: Color(0x1A1A2526),
      blurRadius: 10,
      offset: Offset(0, 2),
      spreadRadius: -4,
    ),
  ];

  /// Flat inset surfaces (option cards, review blocks).
  static const subtle = [
    BoxShadow(color: Color(0x0A1A2526), blurRadius: 2, offset: Offset(0, 1)),
  ];

  /// Filled primary button lift.
  static const button = [
    BoxShadow(
      color: Color(0x800F6E6E),
      blurRadius: 16,
      offset: Offset(0, 6),
      spreadRadius: -6,
    ),
  ];
}

const double bcMinButtonHeight = 56.0;
