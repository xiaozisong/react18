import { mountChildFibers, reconcileChildFibers } from './childFiber';
import { ReactElementType } from './../../shared/ReactTypes';
import {
	HostComponent,
	HostRoot,
	HostText,
	FunctionComponent,
	Fragment
} from './workTags';
import { FiberNode, FiberRootNode } from './fiber';
import { processUpdateQueue, UpdateQueue } from './updateQueue';
import { renderWithHooks } from './fiberHooks';

// 递归中的递阶段
export const beginWork = (wip: FiberNode) => {
	// 比较，返回子fiberNode
	switch (wip.tag) {
		case HostRoot:
			return updateHostRoot(wip);
		case HostComponent:
			return updateHostComponent(wip);
		case HostText:
			return null;
		case FunctionComponent:
			return updateFunctionComponent(wip);
		case Fragment:
			return updateFragment(wip)
		default:
			if (__DEV__) {
				console.warn('beginwork未实现的类型');
			}
			break;
	}
	return null;
};
function updateFragment(wip: FiberNode) {
	const nextChildren = wip.pendingProps;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}
function updateFunctionComponent(wip: FiberNode) {
	const nextChildren = renderWithHooks(wip);
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function updateHostRoot(wip: FiberNode | any) {
	const baseState = wip.memoizedState;
	const updateQueue = wip.updateQueue as UpdateQueue<Element> | any;
	const pending = updateQueue.shared.pending;
	updateQueue.shared.pending = null;
	const { memoizedState } = processUpdateQueue(baseState, pending);
	wip.memoizedState = memoizedState;

	const nextChildren = wip.memoizedState;
	reconcileChildren(wip, nextChildren);

	return wip.child;
}

function updateHostComponent(wip: FiberNode) {
	const nextProps = wip.pendingProps;
	const nextChildren = nextProps.children;
	reconcileChildren(wip, nextChildren);
	return wip.child;
}

function reconcileChildren(wip: FiberNode, children: ReactElementType) {
	const current = wip.alternate;
	if (current !== null) {
		// update
		wip.child = reconcileChildFibers(wip, current?.child, children);
	} else {
		// mount
		wip.child = mountChildFibers(wip, null, children);
	}
}
