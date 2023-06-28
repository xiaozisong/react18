import { Action } from 'shared/ReactTypes';
import {
	createUpdate,
	createUpdateQueue,
	enqueueUpdate,
	UpdateQueue
} from './updateQueue';
import { Dispatcher, Dispatch } from './../../react/src/currentDispatcher';
import { FiberNode } from './fiber';
import internals from 'shared/internals';
import { scheduleUpdateOnFiber } from './workLoop';
let currentlyRenderingFiber: FiberNode | null = null;
let workInProgressHook: Hook | null = null;

const { currentDispatcher } = internals;
interface Hook {
	memoizedState: any;
	updateQueue: unknown;
	next: Hook | null;
}
export function renderWithHooks(wip: FiberNode) {
	currentlyRenderingFiber = wip;
	// 重置
	wip.memoizedState = null;
	const current = wip.alternate;

	if (current !== null) {
		// update
	} else {
		// mount
		currentDispatcher.current = HooksDispatcherOnMount;
	}
	const Component = wip.type;
	const props = wip.pendingProps;
	const children = Component(props);

	// 重置
	currentlyRenderingFiber = null;
	return children;
}

const HooksDispatcherOnMount: Dispatcher = {
	useState: mountState
};

function mountState<State>(
	initialState: (() => State) | State
): [State, Dispatch<State>] {
	// 找到当前useState对应的hook数据
	const hook = mountWorkInProgresHook();
	let memoizedState;
	if (initialState instanceof Function) {
		memoizedState = initialState();
	} else {
		memoizedState = initialState;
	}

	const queue = createUpdateQueue<State>();
	hook.updateQueue = queue;
	hook.memoizedState = memoizedState;
  // @ts-ignore
	const dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue);

	queue.dispatch = dispatch;
	return [memoizedState, dispatch];
}

function dispatchSetState<State>(
	fiber: FiberNode,
	updateQueue: UpdateQueue<State>,
	action: Action<State>
) {
	const update = createUpdate(action);

	enqueueUpdate(updateQueue, update);

	scheduleUpdateOnFiber(fiber);
}

function mountWorkInProgresHook(): Hook {
	const hook: Hook = {
		memoizedState: null,
		next: null,
		updateQueue: null
	};
	if (workInProgressHook === null) {
		// mount时的第一个hook
		if (currentlyRenderingFiber === null) {
			throw new Error('请在函数组件内调用hook');
		} else {
			workInProgressHook = hook;
			currentlyRenderingFiber.memoizedState = workInProgressHook.memoizedState;
		}
	} else {
		// mount后续的hook
		workInProgressHook.next = hook;
		workInProgressHook = hook;
	}
	return workInProgressHook;
}
