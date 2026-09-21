import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { ISideXTaskService } from '../../../../platform/sidex/common/sidexTaskService.js';
import { isTauri } from '../../../../sidex-bridge.js';
import { VerificationProject } from '../common/sysVerification.js';
import { CINEMA_BOOKING_VERIFICATION_PROJECT } from '../common/sysVerificationFixture.js';
import { ProcessResult, VerificationTransport, loadLiveVerification } from '../common/sysVerificationLive.js';
import { VerificationTransportError } from '../common/sysVerificationWire.js';

export const ISysVerificationDataProvider = createDecorator<ISysVerificationDataProvider>('sysVerificationDataProvider');

export interface ISysVerificationDataProvider {
	readonly _serviceBrand: undefined;
	/** Rejects with VerificationTransportError on any live failure; never substitutes fixture data. */
	getProject(): Promise<VerificationProject>;
}

/** Tauri emits snake_case payloads; the shared task-service typings say camelCase. Accept both. */
interface RawTaskEvent { task_id?: number; taskId?: number; exit_code?: number | null; exitCode?: number | null; data?: string; stream?: string }

class TaskProcessTransport implements VerificationTransport {
	constructor(private readonly tasks: ISideXTaskService, private readonly files: IFileService) { }

	exists(path: string): Promise<boolean> {
		return this.files.exists(URI.file(path));
	}

	async run(command: string, args: string[], timeoutMs: number): Promise<ProcessResult> {
		if (!isTauri()) {
			throw new VerificationTransportError('PLATFORM_EXECUTION_ERROR', 'process execution requires the desktop runtime');
		}
		const runs = new Map<number, { out: string[]; err: string[]; exit?: { code: number | null } }>();
		const entry = (id: number) => runs.get(id) ?? (runs.set(id, { out: [], err: [] }), runs.get(id)!);
		let wake: (() => void) | undefined;
		// listeners first: output/exit can arrive before spawn() resolves with the task id
		const unOut = await this.tasks.onOutput(e => {
			const ev = e as unknown as RawTaskEvent;
			entry((ev.task_id ?? ev.taskId)!)[ev.stream === 'stderr' ? 'err' : 'out'].push(ev.data ?? '');
		});
		const unExit = await this.tasks.onExit(e => {
			const ev = e as unknown as RawTaskEvent;
			entry((ev.task_id ?? ev.taskId)!).exit = { code: ev.exit_code ?? ev.exitCode ?? null };
			wake?.();
		});
		let id: number | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			try {
				id = await this.tasks.spawn({ command, args, shell: false });
			} catch (e) {
				throw new VerificationTransportError('EXECUTABLE_NOT_FOUND', String(e));
			}
			const spawned = id;
			const timedOut = await new Promise<boolean>(resolve => {
				wake = () => { if (entry(spawned).exit) { resolve(false); } };
				timer = setTimeout(() => resolve(true), timeoutMs);
				wake();
			});
			if (timedOut) {
				await this.tasks.kill(spawned).catch(() => undefined);
				throw new VerificationTransportError('TIMEOUT', `no result after ${timeoutMs}ms`);
			}
			const done = entry(spawned);
			// ponytail: stderr thread may emit slightly after task-exit; only affects error text.
			// (UTF-8 split across reads is handled in Rust: tasks.rs decode_utf8_chunk.)
			return { exitCode: done.exit!.code, stdout: done.out.join(''), stderr: done.err.join('') };
		} finally {
			clearTimeout(timer);
			unOut();
			unExit();
		}
	}
}

/**
 * The single registered provider. `sys.verification.dataSource` picks Live (default) or Fixture explicitly;
 * a failing live run is an error, not a reason to show fixture data.
 */
class SysVerificationDataProvider implements ISysVerificationDataProvider {
	readonly _serviceBrand: undefined;
	private readonly transport: VerificationTransport;

	constructor(
		@IConfigurationService private readonly config: IConfigurationService,
		@IFileService files: IFileService,
		@ISideXTaskService tasks: ISideXTaskService
	) {
		this.transport = new TaskProcessTransport(tasks, files);
	}

	getProject(): Promise<VerificationProject> {
		if (this.config.getValue<string>('sys.verification.dataSource') === 'fixture') {
			return Promise.resolve({ ...CINEMA_BOOKING_VERIFICATION_PROJECT, dataSource: 'FIXTURE' });
		}
		return loadLiveVerification(this.transport, {
			platformBinary: this.config.getValue<string>('sys.verification.platformBinary') ?? '',
			manifestPath: this.config.getValue<string>('sys.verification.manifestPath') ?? '',
			timeoutMs: this.config.getValue<number>('sys.verification.timeoutMs') ?? 60000
		});
	}
}

registerSingleton(ISysVerificationDataProvider, SysVerificationDataProvider, InstantiationType.Delayed);
