import React from 'react';
import {
	DeviceEventEmitter,
	findNodeHandle,
	NativeModules,
	Platform,
	TextInput,
	type TextInputProps,
} from 'react-native';

export interface KeyboardMedia {
	uri: string;
	fileName: string;
	mimeType: string;
	size: number;
	width?: number;
	height?: number;
}

interface RichContentTextInputProps extends TextInputProps {
	onKeyboardMedia?: (media: KeyboardMedia) => void;
}

interface KeyboardMediaEvent extends KeyboardMedia {
	viewTag: number;
}

type RichContentBridge = {
	attach?: (viewTag: number) => Promise<boolean>;
};

export const RichContentTextInput = React.forwardRef<TextInput, RichContentTextInputProps>(
	function RichContentTextInput({ onKeyboardMedia, ...props }, forwardedRef) {
		const inputRef = React.useRef<TextInput | null>(null);
		const viewTagRef = React.useRef<number | null>(null);
		const onKeyboardMediaRef = React.useRef(onKeyboardMedia);
		onKeyboardMediaRef.current = onKeyboardMedia;

		const setInputRef = React.useCallback(
			(node: TextInput | null) => {
				inputRef.current = node;
				if (typeof forwardedRef === 'function') forwardedRef(node);
				else if (forwardedRef) forwardedRef.current = node;

				if (Platform.OS !== 'android' || !node) return;
				const viewTag = findNodeHandle(node);
				if (!viewTag) return;
				viewTagRef.current = viewTag;
				(NativeModules.RichContentBridge as RichContentBridge | undefined)?.attach?.(
					viewTag,
				);
			},
			[forwardedRef],
		);

		React.useEffect(() => {
			if (Platform.OS !== 'android') return;
			const subscription = DeviceEventEmitter.addListener(
				'wigaj.keyboardMedia',
				(event: KeyboardMediaEvent) => {
					if (event.viewTag === viewTagRef.current) {
						onKeyboardMediaRef.current?.(event);
					}
				},
			);
			return () => subscription.remove();
		}, []);

		return <TextInput ref={setInputRef} {...props} />;
	},
);
