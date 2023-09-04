import { Passive, HookHasEffect } from './hookEffectTags';
import {
	getHighestPriorityLane,
	Lane,
	lanesToSchedulerPriority,
	markRootFinished,
	mergeLanes,
	NoLane,
	SyncLane
} from './fiberLanes';
import {
	commitHookEffectListCreate,
	commitHookEffectListDestory,
	commitHookEffectListUnmount,
	commitLayoutEffects,
	commitMutaionEffects
} from './commitWork';
import { HostRoot } from './workTags';
import { beginWork } from './beginWork';
import { completeWork } from './completeWork';
import {
	createWorkInProgress,
	FiberNode,
	FiberRootNode,
	PendingPassiveEffects
} from './fiber';
import { MutaionMask, NoFlags, PassiveMask } from './fiberFlags';
import { flushSyncCallbacks, scheduleSyncCallback } from './syncTaskQueue';
import { scheduleMicroTask } from 'hostConfig';
import {
	unstable_scheduleCallback as scheduleCallback,
	unstable_NormalPriority as NormalPriority,
	unstable_shouldYield,
	unstable_cancelCallback
} from 'scheduler';

let workInProgress: FiberNode | null = null;
let wipRootRenderLane: Lane = NoLane;
let rootDoesHasPassiveEffects = false;

type RootExitStatue = number;
const RootInComplete = 1;
const RootInCompleted = 2;

// 工作流程第一步 初始化 并进行递归操作
function prepareFreshStack(root: FiberRootNode, lane: Lane) {
	root.finishedLane = NoLane;
	root.finishedWork = null;
	workInProgress = createWorkInProgress(root.current, {});
	wipRootRenderLane = lane;
}

export function scheduleUpdateOnFiber(fiber: FiberNode, lane: Lane) {
	// TODO 调度功能
	const root = markUpdateFromFiberToRoot(fiber);
	markRootUpdated(root, lane);
	ensureRootIsScheduled(root);
}

// schedule阶段入口
function ensureRootIsScheduled(root: FiberRootNode) {
	const updateLane = getHighestPriorityLane(root.pendingLanes);
	const exitingCallback = root.callbackNode;
	if (updateLane === NoLane) {
		if (exitingCallback !== null) {
			unstable_cancelCallback(exitingCallback);
		}
		root.callbackNode = null;
		root.callbackPriotity = NoLane;
		return;
	}

	const curPriority = updateLane;
	const prevPriority = root.callbackPriotity;
	if (curPriority === prevPriority) {
		return;
	}
	if (exitingCallback !== null) {
		unstable_cancelCallback(exitingCallback);
	}

	let newCallbackNode = null;
	if (__DEV__) {
		console.log(
			`在${updateLane === SyncLane ? '微' : '宏'}任务中调度，优先级：`,
			updateLane
		);
	}
	if (updateLane === SyncLane) {
		// 同步优先级 用微任务调度

		scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root, updateLane));
		scheduleMicroTask(flushSyncCallbacks);
	} else {
		// 其他优先级 用宏任务调度
		const schedulerPriority = lanesToSchedulerPriority(updateLane);
		// @ts-ignore
		newCallbackNode = scheduleCallback(
			schedulerPriority,
			performConcurrentWorkOnRoot.bind(null, root)
		);
	}
	root.callbackNode = newCallbackNode;
	root.callbackPriotity = curPriority;
}
function markRootUpdated(root: FiberRootNode, lane: Lane) {
	root.pendingLanes = mergeLanes(root.pendingLanes, lane);
}
function markUpdateFromFiberToRoot(fiber: FiberNode) {
	let node = fiber;
	let parent = node.return;
	while (parent !== null) {
		node = parent;
		parent = node.return;
	}
	if (node.tag === HostRoot) {
		return node.stateNode;
	}

	return null;
}

function performConcurrentWorkOnRoot(
	root: FiberRootNode,
	didTimeout: boolean
): any {
	const curCallback = root.callbackNode;
	const didFlushPassiveEffects = flushPassiveEffects(
		root.pendingPassiveEffects
	);
	if (didFlushPassiveEffects) {
		if (root.callbackNode !== curCallback) {
			return null;
		}
	}
	const lane = getHighestPriorityLane(root.pendingLanes);
	const curCallbackNode = root.callbackNode;
	if (lane === NoLane) {
		return null;
	}
	const needSync = lane === SyncLane || didTimeout;
	const exitStatus = renderRoot(root, lane, !needSync);
	ensureRootIsScheduled(root);
	if (exitStatus === RootInComplete) {
		// 中断
		if (root.callbackNode !== curCallbackNode) {
			return null;
		}
		return performConcurrentWorkOnRoot.bind(null, root);
	}

	if (exitStatus === RootInCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = lane;
		wipRootRenderLane = NoLane;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现并发更新结束状态');
	}
}

function performSyncWorkOnRoot(root: FiberRootNode) {
	const nextLane = getHighestPriorityLane(root.pendingLanes);
	if (nextLane !== SyncLane) {
		// 其他比syncLane低的优先级
		// NoLane
		ensureRootIsScheduled(root);
		return;
	}
	const exitStatus = renderRoot(root, nextLane, false);
	if (exitStatus === RootInCompleted) {
		const finishedWork = root.current.alternate;
		root.finishedWork = finishedWork;
		root.finishedLane = nextLane;
		wipRootRenderLane = NoLane;

		commitRoot(root);
	} else if (__DEV__) {
		console.error('还未实现同步更新结束状态');
	}
}
// 所有工作流程的起始方法 进行递归操作
function renderRoot(root: FiberRootNode, lane: Lane, shouldTimeSlice: boolean) {
	if (__DEV__) {
		console.log(`开始${shouldTimeSlice ? '并发' : '同步'}更新`, root);
	}
	if (wipRootRenderLane !== lane) {
		// 初始化
		prepareFreshStack(root, lane);
	}

	do {
		try {
			shouldTimeSlice ? workLoopConcurrent() : workLoopSync();
			break;
		} catch (e) {
			if (__DEV__) {
				console.warn('workLoop发生错误', e);
			}
			workInProgress = null;
		}
	} while (true);
	//中断执行 || render阶段执行完
	if (shouldTimeSlice && workInProgress !== null) {
		return RootInComplete;
	}
	// render阶段执行完
	if (!shouldTimeSlice && workInProgress !== null && __DEV__) {
		console.error('render阶段结束时wip不应该是null');
	}
	return RootInCompleted;
}

function commitRoot(root: FiberRootNode) {
	// 保存当前的wip
	const finishedWork = root.finishedWork;
	if (finishedWork === null) {
		return;
	}

	if (__DEV__) {
		console.warn('commit阶段开始', finishedWork);
	}
	const lane = root.finishedLane;

	if (lane === NoLane && __DEV__) {
		console.warn('commit阶段finishedLane不应该是Nolane');
	}
	// 重置
	root.finishedWork = null;
	root.finishedLane = NoLane;

	markRootFinished(root, lane);

	if (
		(finishedWork.flags & PassiveMask) !== NoFlags ||
		(finishedWork.subtreeFlags & PassiveMask) !== NoFlags
	) {
		if (!rootDoesHasPassiveEffects) {
			rootDoesHasPassiveEffects = true;
			// 调度副作用
			scheduleCallback(NormalPriority, () => {
				// 执行副作用
				flushPassiveEffects(root.pendingPassiveEffects);
				return;
			});
		}
	}

	// 判断是否存在3个子阶段需要执行的操作
	// root flags  root subtreeflags
	const subtreeHasEffect =
		(finishedWork.subtreeFlags & MutaionMask) !== NoFlags;
	const rootHasEffect = (finishedWork.flags & MutaionMask) !== NoFlags;

	if (subtreeHasEffect || rootHasEffect) {
		// beforeMutaion 执行对应阶段的方法
		commitMutaionEffects(finishedWork, root);
		// mutaion  Placement 将更新后的wip树赋值给current
		root.current = finishedWork;

		commitLayoutEffects(finishedWork, root);
		//layout
	} else {
		// 即使没有更新也要进行此操作
		root.current = finishedWork;
	}

	rootDoesHasPassiveEffects = false;
	ensureRootIsScheduled(root);
}
function flushPassiveEffects(PendingPassiveEffects: PendingPassiveEffects) {
	let didFlushPassiveEffects = false;
	PendingPassiveEffects.unmount.forEach((effect) => {
		didFlushPassiveEffects = true;
		commitHookEffectListUnmount(Passive, effect);
	});
	PendingPassiveEffects.unmount = [];
	PendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffects = true;
		commitHookEffectListDestory(Passive | HookHasEffect, effect);
	});
	PendingPassiveEffects.update.forEach((effect) => {
		didFlushPassiveEffects = true;
		commitHookEffectListCreate(Passive | HookHasEffect, effect);
	});
	PendingPassiveEffects.update = [];
	flushSyncCallbacks();
	return didFlushPassiveEffects;
}

function workLoopSync() {
	while (workInProgress !== null) {
		performUnitOfWork(workInProgress);
	}
}

function workLoopConcurrent() {
	while (workInProgress !== null && !unstable_shouldYield()) {
		performUnitOfWork(workInProgress);
	}
}
// 进行递归的递操作
function performUnitOfWork(fiber: FiberNode) {
	// 将当前fiber节点保存下来 用于下一次递操作
	const next = beginWork(fiber, wipRootRenderLane);
	// 确定当前的props
	fiber.memoizedProps = fiber.pendingProps;
	if (next === null) {
		// 如果当前的子节点为空则进行归操作
		completeUnitOfWork(fiber);
	} else {
		// 否则进行下一次遍历
		workInProgress = next;
	}
}
// 归的工作流程
function completeUnitOfWork(fiber: FiberNode) {
	let node: FiberNode | null = fiber;
	do {
		const next = completeWork(node);
		const sibling = node.sibling;
		// 判断当前fiber是否存在兄弟节点
		if (sibling !== null) {
			// 遍历兄弟节点
			workInProgress = sibling;
			return;
		}
		// 兄弟节点为空后回到父节点
		node = node.return;
		workInProgress = node;
	} while (node !== null);
}
