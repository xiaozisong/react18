import { isSubsetOfLanes, Lane, NoLane } from './fiberLanes';
import { Dispatch } from './../../react/src/currentDispatcher';
import { Action } from 'shared/ReactTypes';
// 更新fiber的操作 例如 setState, 但是setState的传参有两种形式: setState(1) | setState(({ state: 2 }) => 最新的state)
export interface Update<State> {
	action: Action<State>;
	lane: Lane;
	next: Update<any> | null;
}

export interface UpdateQueue<State> {
	shared: {
		pending: Update<State> | null;
	};
	dispatch: Dispatch<State> | null;
}
// 当前update的数据结构，action表明当前执行的更新操作、lane表示优先级、next指向下一个更新
export const createUpdate = <State>(action: Action<State>, lane: Lane) => {
	return {
		action,
		lane,
		next: null
	};
};
// updateQueue是一个链表
export const createUpdateQueue = <State>() => {
	return {
		shared: {
			pending: null
		},
		dispatch: null
	} as UpdateQueue<State>;
};

// 存入UpdateQueue
export const enqueueUpdate = <State>(
	updateQueue: UpdateQueue<State>,
	update: Update<State>
) => {
	const pending = updateQueue.shared.pending;
	if (pending === null) {
		// 初始参与计算的pending为空，修改当前update指向
		update.next = update;
	} else {
		// 环向链表
		update.next = pending.next;
		pending.next = update;
	}
	updateQueue.shared.pending = update;
};

export const processUpdateQueue = <State>(
	baseState: State,
	pendingUpdate: Update<State> | null,
	renderLane: Lane
): {
	memoizedState: State;
	baseState: State;
	baseQueue: Update<State> | null;
} => {
	const result: ReturnType<typeof processUpdateQueue<State>> = {
		//  memoizedState为确定下来的state
		memoizedState: baseState,
		baseState,
		baseQueue: null
	};

	if (pendingUpdate !== null) {
		const first = pendingUpdate.next;
		let pending = pendingUpdate.next as Update<any>;

		let newBaseState = baseState;
		let newBaseQueueFirst: Update<State> | null = null;
		let newBaseQueueLast: Update<State> | null = null;
		const newState = baseState;

		do {
			const updateLane = pending.lane;
			if (!isSubsetOfLanes(renderLane, updateLane)) {
				// 优先级不够，被跳过
				const clone = createUpdate(pending.action, pending.lane);
				// 是不是第一个被跳过的update
				if (newBaseQueueFirst === null) {
					// first u0 last = u0
					newBaseQueueFirst = clone;
					newBaseQueueLast = clone;
					newBaseState = newState;
				} else {
					// first u0 -> u1
					// last u1
					(newBaseQueueLast as Update<State>).next = clone;
					newBaseQueueLast = clone;
				}
				if (__DEV__) {
					console.error('不应该进入');
				}
			} else {
				// 优先级足够
				if (newBaseQueueLast !== null) {
					const clone = createUpdate(pending.action, NoLane);
					newBaseQueueLast.next = clone;
					newBaseQueueLast = clone;
				}

				// 判断action的类型，如果为函数则调用action并传入baseState: baseState 1 update (x) => 4x -> memoizedState 4
				const action = pending.action;
				if (action instanceof Function) {
					baseState = action(baseState);
				} else {
					//直接赋值的话 就将 baseState 赋值为 action: baseState 1 update 2 -> memoizedState 2
					baseState = action;
				}
			}
			pending = pending.next as Update<any>;
		} while (pending !== first);

		if (newBaseQueueLast === null) {
			// 本次计算没有update被跳过
			newBaseState = newState;
		} else {
			// 有update被跳过
			newBaseQueueLast.next = newBaseQueueFirst;
		}
		result.memoizedState = newState;
		result.baseState = newBaseState;
		result.baseQueue = newBaseQueueLast;
	}
	return result;
};
