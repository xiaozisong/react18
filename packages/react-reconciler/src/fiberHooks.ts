import { Passive, HookHasEffect } from './hookEffectTags';
import { Flags, PassiveEffect } from './fiberFlags';
import { Action, ReactContext } from 'shared/ReactTypes';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	processUpdateQueue,
	Update,
	UpdateQueue
} from './updateQueue';
import { Dispatcher, Dispatch } from './../../react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import { scheduleUpdateOnFiber } from './workLoop';
import { requestUpdateLane, NoLane, Lane } from './fiberLanes';
import currentBatchConfig from 'react/src/currentBatchConfig';
// 当前渲染的fiber
let currentlyRenderingFiber: FiberNode | null = null;
// 当前的wiphook鱼currenthook
let workInProgressHook: Hook | null = null;
let currentHook: Hook | null = null;
let renderLane: Lane = NoLane;
// 全局的数据共享层，知道当前的hook是存在于哪个fiber下的
const { currentDispatcher } = internals;
// hook的数据结构
interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
	baseState: any;
	baseQueue: Update<any> | null;
}

export interface Effect {
	tag: Flags;
	create: EffectCallback | void;
	destory: EffectCallback | void;
	deps: EffectDeps;
	next: Effect | null;
}
export interface FCUpdateQueue<State> extends UpdateQueue<State> {
	lastEffect: Effect | null;
}
type EffectDeps = any[] | null;
type EffectCallback = () => void;
export function renderWithHooks(wip: FiberNode, lane: Lane) {
	// 赋值fiber
	currentlyRenderingFiber = wip;
	// 重置update链表
	wip.memoizedState = null;
	// 重置effect链表
	wip.updateQueue = null;
	renderLane = lane;
	// 获取当前真实Fiber
	const current = wip.alternate;

	if (current !== null) {
		// update
		currentDispatcher.current = HooksDispatcherOnUpdate;
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	// FC render
	const children = Component(props);

	// 重置
	currentlyRenderingFiber = null;
	workInProgressHook = null;
	currentHook = null;
	renderLane = NoLane;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState,
	useEffect: mountEffect,
	useTransition: mountTransition,
	useRef: mountRef,
	useContext: readContext
};

const HooksDispatcherOnUpdate: Dispatcher = {
	useState: updateState,
	useEffect: updateEffect,
	useTransition: updateTransition,
	useRef: updateRef,
	useContext: readContext
};
function mountEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgresHook();
	const nextDeps = deps === undefined ? null : deps;

	(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;

	hook.memoizedState = pushEffect(
		Passive | HookHasEffect,
		create,
		undefined,
		nextDeps
	);
}

function updateEffect(create: EffectCallback | void, deps: EffectDeps | void) {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgresHook();
	const nextDeps = deps === undefined ? null : deps;
	let destory: EffectCallback | void;

	if (currentHook !== null) {
		const prevEffect = currentHook.memoizedState as Effect;
		destory = prevEffect.destory;
		if (nextDeps !== null) {
			// 浅比较
			const prevDeps = prevEffect.deps;
			if (areHookInputEqual(nextDeps, prevDeps)) {
				hook.memoizedState = pushEffect(Passive, create, destory, nextDeps);
				return;
			}
		}
		// 浅比较后不相等
		(currentlyRenderingFiber as FiberNode).flags |= PassiveEffect;
		hook.memoizedState = pushEffect(
			Passive | HookHasEffect,
			create,
			destory,
			nextDeps
		);
	}
}

function areHookInputEqual(nextDeps: EffectDeps, prevDeps: EffectDeps) {
	if (prevDeps === null || nextDeps === null) {
		return false;
	}
	for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
		if (Object.is(prevDeps[i], nextDeps[i])) {
			continue;
		}
		return false;
	}
	return true;
}

function pushEffect(
	hookFlags: Flags,
	create: EffectCallback | void,
	destory: EffectCallback | void,
	deps: EffectDeps
): Effect {
	const effect: Effect = {
		tag: hookFlags,
		create,
		destory,
		deps,
		next: null
	};
	const fiber = currentlyRenderingFiber as FiberNode;
	const updateQueue = fiber.updateQueue as FCUpdateQueue<any>;

	if (updateQueue === null) {
		const updateQueue = createFCUpdateQueue();
		fiber.updateQueue = updateQueue;
		effect.next = effect;
		updateQueue.lastEffect = effect;
	} else {
		// 插入effect
		const lastEffect = updateQueue.lastEffect;
		if (lastEffect === null) {
			effect.next = effect;
			updateQueue.lastEffect = effect;
		} else {
			const firstEffect = lastEffect.next;
			lastEffect.next = effect;
			effect.next = firstEffect;
			updateQueue.lastEffect = effect;
		}
	}
	return effect;
}

function createFCUpdateQueue<State>() {
	const updateQueue = createFCUpdateQueue<State>() as FCUpdateQueue<State>;
	updateQueue.lastEffect = null;
	return updateQueue;
}
// update时的state操作
function updateState<State>(): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = updateWorkInProgresHook();
	// 获取当前的updateQueue
	const queue = hook.updateQueue as UpdateQueue<State>;

	const baseState = hook.baseState;
	const pending = queue.shared.pending;
	const current = currentHook as Hook;
	let baseQueue = current.baseQueue;

	if (pending !== null) {
		// pending baseQueue update保存在current中
		if (baseQueue !== null) {
			const baseFirst = baseQueue.next;
			const pendingFirst = pending.next;

			baseQueue.next = pendingFirst;
			pending.next = baseFirst;
		}

		baseQueue = pending;

		// 保存在current中
		current.baseQueue = pending;
		queue.shared.pending = null;
	}
	if (baseQueue !== null) {
		const {
			memoizedState,
			baseQueue: newBaseQueue,
			baseState: newBaseState
		} = processUpdateQueue(baseState, baseQueue, renderLane);
		hook.memoizedState = memoizedState;
		hook.baseState = newBaseState;
		hook.baseQueue = newBaseQueue;
	}

	return [hook.memoizedState, queue.dispatch as Dispatch<State>];
}

function updateWorkInProgresHook(): Hook {
	//  TODO render时触发的
	let nextCurrentHook: Hook | null;
	if (currentHook === null) {
		// 这是这个FC update时的第一个hook
		const current = currentlyRenderingFiber?.alternate; // 获取当前的current Fiber树
		if (current !== null) {
			// update
			nextCurrentHook = current?.memoizedState;
		} else {
			// mount
			nextCurrentHook = null;
		}
	} else {
		// 这个FC update时后续的hook
		nextCurrentHook = currentHook.next;
	}

	if (nextCurrentHook === null) {
		// mount / update u1 u2 u3
		throw new Error(
			`组件${currentlyRenderingFiber?.type}本次执行时的Hook比上次执行时多`
		);
	}

	currentHook = nextCurrentHook as Hook;
	// 新建newHook
	const newHook: Hook = {
		memoizedState: currentHook.memoizedState,
		updateQueue: currentHook.updateQueue,
		next: null,
		baseQueue: currentHook.baseQueue,
		baseState: currentHook.baseState
	};
	// mount时的第一个hook
	if (workInProgressHook === null) {
		// 说明是在函数组件之外调用的hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			// 赋值操作
			workInProgressHook = newHook;
			currentlyRenderingFiber.memoizedState = workInProgressHook.memoizedState;
		}
	} else {
		// mount后续的hook
		workInProgressHook.next = newHook;
		workInProgressHook = newHook;
	}
	// 返回hook
	return workInProgressHook;
}
// 渲染时执行的state，接收一个初始state
function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgresHook();
	let memoizedState;
	// 判断传入的初始state类型
	if (initialState instanceof Function) {
		// 将function执行的结果赋值给memoizedState
		memoizedState = initialState();
	} else {
		// 直接赋值
		memoizedState = initialState;
	}
	// 创建一个queue
	const queue = createUpdateQueue<State>();
	// 赋值操作
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;
	hook.baseState = memoizedState;
	// @ts-ignore 这里的操作是将dispatchSetState方法绑定在当前的fiber身上
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);
	// 赋值
	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

function mountTransition(): [boolean, (callback: () => void) => void] {
	const [isPending, setPending] = mountState(false);
	const hook = mountWorkInProgresHook();
	const start = startTransition.bind(null, setPending);
	hook.memoizedState = start;
	return [isPending, start];
}
function updateTransition(): [boolean, (callback: () => void) => void] {
	const [isPending] = updateState();
	const hook = updateWorkInProgresHook();
	const start = hook.memoizedState;
	return [isPending as boolean, start];
}

function startTransition(setPending: Dispatch<boolean>, callback: () => void) {
	setPending(true);
	const prevTransition = currentBatchConfig.transition;
	currentBatchConfig.transition = 1;

	callback();
	setPending(false);

	currentBatchConfig.transition = prevTransition;
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	// 获取lane
	const lane = requestUpdateLane();
	// 创建当前的update
	const update = createUpdate(action, lane);
	// 将当前update入队
	enqueueUpdate(updateQueue, update);
	// 重启调度流程
	scheduleUpdateOnFiber(fiber, lane);
}

function mountWorkInProgresHook(): Hook {
	// 创建一个hook链表
	const hook: Hook = {
		memoizedState: null,
		next: null,
		updateQueue: null,
		baseQueue: null,
		baseState: null
	};
	// 代表当前Mount时
	if (workInProgressHook === null) {
		// mount时的第一个hook，如果currentlyRenderingFiber === null，表明当前调用hook时脱离 FC 环境的
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			// 赋值
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook.memoizedState;
		}
	} else {
		// mount后续的hook 例如初次Mount时 FC中有 useState、useEffect...
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	// 返回hook
	return workInProgressHook;
}

// re = useRef()
function mountRef<T>(initialValue: T): { current: T } {
	const hook = mountWorkInProgresHook();
	const ref = { current: initialValue };
	hook.memoizedState = ref;
	return ref;
}

function updateRef<T>(initialValue: T): { current: T } {
	const hook = updateWorkInProgresHook();
	return hook.memoizedState;
}

function readContext<T>(context: ReactContext<T>): T {
	const consumer = currentlyRenderingFiber;
	if (consumer === null) {
		throw new Error('请在函数组件内调用useContext');
	}
	const value = context._currentValue;
	return value;
}
