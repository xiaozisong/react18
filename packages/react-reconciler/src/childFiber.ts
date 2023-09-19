import { REACT_FRAGMENT_TYPE } from './../../shared/ReactSymbols';
import { ChildDeletion, Placement } from './fiberFlags';
import { HostText, Fragment } from './workTags';
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols';
import { ReactElementType, Props, Key } from './../../shared/ReactTypes';
import {
	createFiberFromElement,
	createFiberFromFragment,
	createWorkInProgress,
	FiberNode
} from './fiber';

type ExistingChildren = Map<string | number, FiberNode>;
// 节点的diff
function ChildReconciler(shouldTrackEffects: boolean) {
	// 删除节点
	function deleteChild(returnFiber: FiberNode, childToDelete: FiberNode) {
		// 不需要追踪副作用，直接return掉当前方法
		if (!shouldTrackEffects) {
			return;
		}
		// 获取fiber的deletions数组
		const deletions = returnFiber.deletions;
		if (deletions === null) {
			// 标记ChildDeletion
			returnFiber.deletions = [childToDelete];
			// 打删除标记
			returnFiber.flags |= ChildDeletion;
		} else {
			// 向数组中追加要删除的元素
			deletions.push(childToDelete);
		}
	}
	// 删除剩余的节点
	function deleteRemainingChildren(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null
	) {
		if (!shouldTrackEffects) {
			return;
		}
		let childToDelete = currentFirstChild;
		// 如果要删除的fiber不为空，则遍历删除 
		while (childToDelete !== null) {
			deleteChild(returnFiber, childToDelete);
			// 赋值为兄弟节点
			childToDelete = childToDelete.sibling;
		}
	}
	// 单一节点的diff
	function reconcileSingleElement(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		element: ReactElementType
	) {
		const key = element.key;
		// update阶段
		while (currentFiber !== null) {
			// key 相同
			if (currentFiber.key === key) {
				// 判断element的type
				if (element.$$typeof === REACT_ELEMENT_TYPE) {
					// type也相同
					if (currentFiber.type === element.type) {
						let props = element.props;
						if (element.type === REACT_FRAGMENT_TYPE) {
							props = element.props.children;
						}
						// type 相同 复用fiber
						const existing = useFiber(currentFiber, props);
						existing.return = returnFiber;
						// 当前节点可复用，标记剩下的节点可删除  a1 b2 -> a1
						deleteRemainingChildren(returnFiber, currentFiber.sibling);
						return existing;
					}
					// key相同，type不同 删掉所有旧的 a1 b2 -> b1
					deleteRemainingChildren(returnFiber, currentFiber);
					break;
				} else {
					if (__DEV__) {
						console.warn('还未实现的react类型', element);
						break;
					}
				}
			} else {
				// key不同 删除旧的 a1 -> a2
				deleteChild(returnFiber, currentFiber);
				currentFiber = currentFiber.sibling;
			}
		}
		// 根据element创建fiber
		let fiber;
		if (element.type === REACT_FRAGMENT_TYPE) {
			fiber = createFiberFromFragment(element.props.children, key);
		} else {
			fiber = createFiberFromElement(element);
		}
		fiber.return = returnFiber;
		return fiber;
	}
	// 文本节点的diff
	function reconcileSingleTextNode(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		content: string | number
	) {
		while (currentFiber !== null) {
			//update
			if (currentFiber.tag === HostText) {
				// 类型没变，可以复用
				const existing = useFiber(currentFiber, { content });
				existing.return = returnFiber;
				// 删除所有兄弟节点 1 3 -> 1
				deleteRemainingChildren(returnFiber, currentFiber.sibling);
				return existing;
			}
			// 删除所有兄弟节点
			deleteChild(returnFiber, currentFiber);
			currentFiber = currentFiber.sibling;
		}
		// 创建新的text node
		const fiber = new FiberNode(HostText, { content }, null);
		fiber.return = returnFiber;
		return fiber;
	}

	// 标记Placement的flags
	function placeSingleChild(fiber: FiberNode) {
		if (shouldTrackEffects && fiber.alternate === null) {
			fiber.flags |= Placement;
		}
		return fiber;
	}
	// 多节点的diff
	function reconcileChildrenArray(
		returnFiber: FiberNode,
		currentFirstChild: FiberNode | null,
		newChild: any[]
	) {
		// 最后一个可复用fiber在current中的index
		let lastPlacedIndex = 0;
		// 创建的最后一个fiber
		let lastNewFiber: FiberNode | null = null;
		let firstNewFiber: FiberNode | null = null;
		// 将current保存在map中
		const existingChildren: ExistingChildren = new Map();

		let current = currentFirstChild;
		while (current !== null) {
			const keyToUse = current.key !== null ? current.key : current.index;
			// set到map中
			existingChildren.set(keyToUse, current);
			// 赋值为兄弟节点
			current = current.sibling;
		}
		// 遍历newchild，寻找是否可复用
		for (let i = 0; i < newChild.length; i++) {
			const after = newChild[i];
			// 获取复用的或者新的fiber
			const newFiber = updateFromMap(returnFiber, existingChildren, i, after);
			if (newFiber === null) {
				continue;
			}

			// 标记移动还是插入
			newFiber.index = i;
			newFiber.return = returnFiber;
			if (lastNewFiber === null) {
				lastNewFiber = newFiber;
				firstNewFiber = newFiber;
			} else {
				lastNewFiber.sibling = newFiber;
				lastNewFiber = lastNewFiber.sibling;
			}
			if (!shouldTrackEffects) {
				continue;
			}
			// 获取current fiber
			const current = newFiber.alternate;
			if (current !== null) {
				// a1 = 0  b2 = 1 c3 = 2    ->   b2 = 0 c3 = 1 a1 = 2 三个元素只是index发生变化
				// 在遍历到 
				const oldIndex = current.index; // 获取旧的index
				// 
				if (oldIndex < lastPlacedIndex) {
					// 移动
					newFiber.flags |= Placement;
					continue;
				} else {
					// 不移动
					lastPlacedIndex = oldIndex;
				}
			} else {
				// mount 标记插入
				newFiber.flags |= Placement;
			}
		}

		// 将map中剩下的标记为删除
		existingChildren.forEach((fiber) => {
			deleteChild(returnFiber, fiber);
		});
		return firstNewFiber;
	}

	function updateFromMap(
		returnFiber: FiberNode,
		existingChildren: ExistingChildren,
		index: number,
		element: any
	): FiberNode | null {
		const keyToUse = element.key !== null ? element.key : index;
		// 获取节点
		const before = existingChildren.get(keyToUse);
		// HostText
		if (typeof element === 'string' || typeof element === 'number') {
			// 如果before节点存在，就是更新之前的节点
			if (before) {
				// 并且类型相同
				if (before.tag === HostText) {
					// 说明可以复用，从map中删除
					existingChildren.delete(keyToUse);
					// 返回复用的节点
					return useFiber(before, { content: element + '' });
				}
			}
			// 新建一个fiber node节点并返回
			return new FiberNode(HostText, { content: element + '' }, null);
		}

		// ReactElement
		if (typeof element === 'object' && element !== null) {
			switch (element.$$typeof) {
				case REACT_ELEMENT_TYPE:
					if (element.type === REACT_FRAGMENT_TYPE) {
						return updateFragment(
							returnFiber,
							before,
							element,
							keyToUse,
							existingChildren
						);
					}
					if (before) {
						if (before.type === element.type) {
							existingChildren.delete(keyToUse);
							return useFiber(before, element.props);
						}
					}
					return createFiberFromElement(element);
			}

			if (Array.isArray(element) && __DEV__) {
				console.warn('还未实现数组类型的child');
			}
		}

		if (Array.isArray(element)) {
			return updateFragment(
				returnFiber,
				before,
				element,
				keyToUse,
				existingChildren
			);
		}
		return null;
	}
	return function reconcileChildFibers(
		returnFiber: FiberNode,
		currentFiber: FiberNode | null,
		newChild?: ReactElementType
	) {
		// 判断fragment
		const isUnKeyedTopLevelFragment =
			typeof newChild === 'object' &&
			newChild !== null &&
			newChild.type === REACT_FRAGMENT_TYPE &&
			newChild.key === null;
		if (isUnKeyedTopLevelFragment) {
			newChild = newChild?.props.children;
		}

		// 判断当前fiber的类型
		if (typeof newChild === 'object' && newChild !== null) {
			// 如果当前newChild是数组，说明是多节点的diff
			if (Array.isArray(newChild)) {
				// 多节点diff的方法
				return reconcileChildrenArray(returnFiber, currentFiber, newChild);
			}

			switch (newChild.$$typeof) {
				case REACT_ELEMENT_TYPE:
					return placeSingleChild(
						// 单节点
						reconcileSingleElement(returnFiber, currentFiber, newChild)
					);

				default:
					if (__DEV__) {
						console.warn('未实现的reconcile类型', newChild);
					}
					break;
			}
		}
		// 多节点的情况
		// HostText
		if (typeof newChild === 'string' || typeof newChild === 'number') {
			return placeSingleChild(
				// 文本节点的情况
				reconcileSingleTextNode(returnFiber, currentFiber, newChild)
			);
		}
		if (currentFiber !== null) {
			// 兜底删除
			deleteRemainingChildren(returnFiber, currentFiber);
		}

		if (__DEV__) {
			console.warn('未实现的reconcile类型', newChild);
		}
		// return fibernode
		return null;
	};
}
// 复用
function useFiber(fiber: FiberNode, pendingProps: Props): FiberNode {
	// 创建复用fiber
	const clone = createWorkInProgress(fiber, pendingProps);
	clone.index = 0;
	clone.sibling = null;
	return clone;
}
function updateFragment(
	returnFiber: FiberNode,
	current: FiberNode | undefined,
	elements: any[],
	key: Key,
	existingChildren: ExistingChildren
) {
	let fiber;
	// mount || tag不是fragment，则创建一个
	if (!current || current.tag !== Fragment) {
		fiber = createFiberFromFragment(elements, key);
	} else {
		// 复用
		existingChildren.delete(key);
		fiber = useFiber(current, elements);
	}
	fiber.return = returnFiber;
	return fiber;
}
export const reconcileChildFibers = ChildReconciler(true);
export const mountChildFibers = ChildReconciler(false);
