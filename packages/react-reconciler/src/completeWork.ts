import { Container } from '../../react-dom/src/hostConfig';
import {
	appendInitialChild,
	createInstance,
	createTextInstance,
	Instance
} from '../../react-dom/src/hostConfig';
import {
	HostComponent,
	HostText,
	HostRoot,
	FunctionComponent,
	Fragment,
	ContextProvider,
	OffscreenComponent,
	SuspenseComponent
} from './workTags';
import { FiberNode } from './fiber';
import { NoFlags, Ref, Update, Visibility } from './fiberFlags';
import { updateFiberProps } from 'react-dom/src/SyntheticEvent';
import { popProvider } from './fiberContext';

function markUpdate(fiber: FiberNode) {
	fiber.flags |= Update;
}
export const completeWork = (wip: FiberNode) => {
	// 递归中的归

	const newProps = wip.pendingProps;
	const current = wip.alternate;
	switch (wip.tag) {
		case HostComponent:
			if (current !== null && wip.stateNode) {
				// update
				// props是否变化
				markUpdate(wip);
				// 标记ref
				if (current.ref !== wip.ref) {
					markRef(wip);
				}
			} else {
				// mount
				// 1. 构建DOM
				const instance = createInstance(wip.type, newProps);
				// 2. 将DOM插入到DOM树中
				appendAllChildren(instance, wip);
				wip.stateNode = instance;
				// 标记ref
				if (wip.ref !== null) {
					markRef(wip);
				}
			}
			bubbleProperties(wip);
			return null;
		case HostText:
			if (current !== null && wip.stateNode) {
				// update
				const oldText = current.memoizedProps.content;
				const newText = newProps.content;
				if (oldText !== newText) {
					markUpdate(wip);
				}
			} else {
				// mount
				// 1. 构建DOM
				const instance = createTextInstance(newProps.content);
				wip.stateNode = instance;
			}
			bubbleProperties(wip);
			return null;
		case HostRoot:
		case FunctionComponent:
		case Fragment:
		case OffscreenComponent:
			bubbleProperties(wip);
			return null;
		case ContextProvider:
			const context = wip.type._context;
			popProvider(context);
			bubbleProperties(wip);
			return null;
		case SuspenseComponent:
			const offscreenFiber = wip.child as FiberNode;
			const isHidden = offscreenFiber.pendingProps.mode === 'hidden';
			const currentOffscreenFiber = offscreenFiber.alternate;

			if (currentOffscreenFiber !== null) {
				const wasHidden = currentOffscreenFiber.pendingProps.mode === 'hidden';
				if (isHidden !== wasHidden) {
					offscreenFiber.flags |= Visibility;
					bubbleProperties(offscreenFiber);
				}
			} else if (isHidden) {
				offscreenFiber.flags |= Visibility;
				bubbleProperties(offscreenFiber);
			}
			bubbleProperties(wip);
			return null;
		default:
			if (__DEV__) {
				console.warn('未处理的completeWORK情况', wip);
			}
			break;
	}
};

function appendAllChildren(parent: Container | Instance, wip: FiberNode) {
	let node = wip.child;

	while (node !== null) {
		if (node?.tag === HostComponent || node?.tag === HostText) {
			appendInitialChild(parent, node.stateNode);
		} else if (node.child !== null) {
			node.child.return = node;
			node = node.child;
			continue;
		}

		if (node === wip) {
			return;
		}

		while (node.sibling === null) {
			if (node.return === null || node.return === wip) {
				return;
			}
			node = node?.return;
		}
		node.sibling.return = node.return;
		node = node.sibling;
	}
}
// 冒泡
function bubbleProperties(wip: FiberNode) {
	let subtreeFlags = NoFlags;
	// 正在处理的Fiber节点的第一个子节点
	let child = wip.child;
	while (child !== null) {
		// 为每个节点打上tag
		subtreeFlags |= child.subtreeFlags;
		subtreeFlags |= child.flags;

		child.return = wip;
		child = child.sibling;
	}

	wip.subtreeFlags |= subtreeFlags;
}

function markRef(fiber: FiberNode) {
	fiber.flags |= Ref;
}
