import 'package:flutter/material.dart';
import '../tokens.dart';

/// Labelled text field. Mirrors the mockup `TextInput`: optional 14/600 label,
/// 56px field with 12px corners and a 1.5px border that thickens to 2px teal on
/// focus, optional 13px helper line. `mono` switches to the 18/600 tracking-code
/// treatment with 1px letter spacing.
class BcTextInput extends StatefulWidget {
  const BcTextInput({
    super.key,
    required this.controller,
    this.label,
    this.hint,
    this.helper,
    this.mono = false,
    this.keyboardType,
  });

  final TextEditingController controller;
  final String? label;
  final String? hint;
  final String? helper;
  final bool mono;
  final TextInputType? keyboardType;

  @override
  State<BcTextInput> createState() => _BcTextInputState();
}

class _BcTextInputState extends State<BcTextInput> {
  final FocusNode _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
  }

  void _onFocusChange() {
    if (_focusNode.hasFocus != _focused) {
      setState(() => _focused = _focusNode.hasFocus);
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChange);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final textStyle = TextStyle(
      fontSize: widget.mono ? 18 : BcType.body,
      fontWeight: widget.mono ? FontWeight.w600 : FontWeight.w400,
      letterSpacing: widget.mono ? 1 : 0,
      height: 1.2,
      color: BcColors.text1,
      fontFamily: widget.mono ? BcType.mono : null,
      fontFamilyFallback: widget.mono
          ? const <String>['Menlo', 'Courier New', 'monospace']
          : null,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: BcColors.text2,
            ),
          ),
          const SizedBox(height: BcSpace.xs),
        ],
        Container(
          constraints: const BoxConstraints(minHeight: bcMinButtonHeight),
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: BcSpace.sm),
          decoration: BoxDecoration(
            color: BcColors.surface,
            borderRadius: BorderRadius.circular(BcRadii.button),
            border: Border.all(
              color: _focused ? BcColors.teal : BcColors.border,
              width: _focused ? 2 : 1.5,
            ),
          ),
          child: TextField(
            controller: widget.controller,
            focusNode: _focusNode,
            keyboardType: widget.keyboardType,
            style: textStyle,
            cursorColor: BcColors.teal,
            decoration: InputDecoration(
              hintText: widget.hint,
              hintStyle: const TextStyle(
                fontSize: BcType.body,
                fontWeight: FontWeight.w400,
                letterSpacing: 0,
                color: BcColors.muted,
              ),
              isDense: true,
              filled: false,
              contentPadding: EdgeInsets.zero,
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
            ),
          ),
        ),
        if (widget.helper != null) ...[
          const SizedBox(height: BcSpace.xs),
          Text(
            widget.helper!,
            style: const TextStyle(
              fontSize: BcType.small,
              color: BcColors.text2,
              height: BcType.lineHeight,
            ),
          ),
        ],
      ],
    );
  }
}
