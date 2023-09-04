import {
	REACT_CONTEXT_TYPE,
	REACT_PROVIDER_TYPE,
	REACT_SUSPENSE_TYPE
} from './../../shared/ReactSymbols';
import { Effect } from './fiberHooks';
import { Lane, Lanes, NoLane, NoLanes } from './fiberLanes';
import { ReactElementType, Ref } from './../../shared/ReactTypes';
import { Props, Key } from 'shared/ReactTypes';
import {
	FunctionComponent,
	WorkTag,
	HostComponent,
	Fragment,
	ContextProvider,
	SuspenseComponent
} from './workTags';
import { NoFlags, Flags } from './fiberFlags';
import { Container } from '../../react-dom/src/hostConfig';
import { CallbackNode } from 'scheduler';

export interface OffscreenProps {
	mode: 'hidden' | 'visible';
	children: any;
}
export class FiberNode {
	// 标识 function component | class component
	type: any;
	// function : 0 ....
	tag: WorkTag;
	// beginWork时的预先props
	pendingProps: Props;
	key: Key;
	// div | p | span...HTML的节点类型
	stateNode: any;
	// 父节点 命名为return意为completeWork时的归阶段最后都会回到父节点 遂取名为return
	return: FiberNode | null;
	// 兄弟节点
	sibling: FiberNode | null;
	// 子节点
	child: FiberNode | null;
	// 例如 ul -> li * 3, 第一个li的index为0， 第二个li的index为1
	index: number;
	// 
	ref: Ref | null;
	// completeWork后确定下来的props
	memoizedProps: Props | null;
	// completeWork后确定下来的state
	memoizedState: any;
	// 因为使用了双缓存技术，current指针为对应当前真实的ui，workInProgress指针指向在reconciler阶段计算的ui
	alternate: FiberNode | null;
	// 插入、删除、新增、修改等操作
	flags: Flags;
	subtreeFlags: Flags;
	updateQueue: unknown;
	deletions: FiberNode[] | null;

	constructor(tag: WorkTag, pendingProps: Props, key: Key) {
		this.tag = tag;
		this.key = key || null;
		this.stateNode = null;
		this.type = null;
		// 构成树状结构
		this.return = null;
		this.sibling = null;
		this.child = null;
		this.index = 0;

		this.ref = null;

		// 作为工作单元
		this.pendingProps = pendingProps;
		this.memoizedProps = null;
		this.updateQueue = null;
		this.memoizedState = null;

		this.alternate = null;
		// 副作用
		this.flags = NoFlags;
		this.subtreeFlags = NoFlags;
		this.deletions = null;
	}
}

export interface PendingPassiveEffects {
	unmount: Effect[];
	update: Effect[];
}

export class FiberRootNode {
	container: Container;
	current: FiberNode;
	finishedWork: FiberNode | null;
	pendingLanes: Lanes;
	finishedLane: Lane;
	pendingPassiveEffects: PendingPassiveEffects;
	callbackNode: CallbackNode | null;
	callbackPriotity: Lane;
	constructor(container: Container, hostRoorFiber: FiberNode) {
		this.container = container;
		this.current = hostRoorFiber;
		hostRoorFiber.stateNode = this;
		this.finishedWork = null;
		this.pendingLanes = NoLanes;
		this.finishedLane = NoLane;
		this.callbackNode = null;
		this.callbackPriotity = NoLane;
		this.pendingPassiveEffects = {
			unmount: [],
			update: []
		};
	}
}

export const createWorkInProgress = (
	current: FiberNode,
	pendingProps: Props
): FiberNode => {
	let wip = current.alternate;

	if (wip === null) {
		//mount
		wip = new FiberNode(current.tag, pendingProps, current.key);
		wip.stateNode = current.stateNode;
		wip.alternate = current.alternate;
		current.alternate = wip;
	} else {
		// update
		wip.pendingProps = pendingProps;
		wip.flags = NoFlags;
		wip.subtreeFlags = NoFlags;
		wip.deletions = null;
	}
	wip.type = current.type;
	wip.updateQueue = current.updateQueue;
	wip.child = current.child;
	wip.memoizedProps = current.memoizedProps;
	wip.memoizedState = current.memoizedState;
	wip.ref = current.ref;
	return wip;
};

export function createFiberFromElement(element: ReactElementType): FiberNode {
	const { type, key, props, ref } = element;
	let fiberTag: WorkTag = FunctionComponent;

	if (typeof type === 'string') {
		// <div>

		fiberTag = HostComponent;
	} else if (
		typeof type === 'object' &&
		type.$$typeof === REACT_PROVIDER_TYPE
	) {
		fiberTag = ContextProvider;
	} else if (type === REACT_SUSPENSE_TYPE) {
		fiberTag = SuspenseComponent;
	} else if (typeof type !== 'function' && __DEV__) {
		console.warn('未定义的type类型', element);
	}

	const fiber = new FiberNode(fiberTag, props, key);
	fiber.type = type;
	fiber.ref = ref;
	return fiber;
}

export function createFiberFromFragment(elements: any[], key: Key): FiberNode {
	const fiber = new FiberNode(Fragment, elements, key);
	return fiber;
}
export function createFiberOnOffscreen(
	pendingProps: OffscreenProps
): FiberNode {
	const fiber = new FiberNode(Fragment, pendingProps, null);
	return fiber;
}
