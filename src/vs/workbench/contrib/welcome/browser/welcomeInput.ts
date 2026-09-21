import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { EditorInputCapabilities, IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

export class WelcomeInput extends EditorInput {
	static readonly ID = 'sidex.welcome.input';

	readonly resource = URI.from({ scheme: 'sidex-welcome', path: 'welcome' });

	override get capabilities(): EditorInputCapabilities {
		return super.capabilities | EditorInputCapabilities.Singleton;
	}

	override get typeId(): string { return WelcomeInput.ID; }
	override getName(): string { return localize('sidexWelcome', 'Welcome'); }
	override getIcon(): ThemeIcon { return Codicon.home; }
	override matches(other: EditorInput | IUntypedEditorInput): boolean { return super.matches(other) || other instanceof WelcomeInput; }
}
