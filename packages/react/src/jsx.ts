// React Element
import { REACT_ELEMENT_TYPE } from 'shared/ReactSymbols'
import { Type, Key, Ref, Props, ReactElementType, ElementType } from 'shared/ReactTypes'
const ReactElement = function (type: Type, key: Key, ref: Ref, props: Props): ReactElementType {
  const element = {
    $$typeof: REACT_ELEMENT_TYPE,
    key,
    type,
    ref,
    props,
    __mark: 'shawn'
  }
  return element
}

export const jsx = (type:ElementType, config: any, ...maybeChildren: any) => {
  let key: Key = null
  const props: Props = {}
  let ref: Ref = null

  for (const prop in config) {
    const val = config[prop]
    if (prop === 'key') {
      if (val !== undefined) {
        key = "" + val
      }
      continue
    }
    if (prop === 'ref') {
      if (val !== undefined) {
        ref = val
      }
      continue
    }
    if ({}.hasOwnProperty.call(config, props)) {
      props[prop] = val
    }
  }
  const maybeChildrenLenth = maybeChildren.length
  if (maybeChildrenLenth) {
    // [child] [child,child,child]
    if (maybeChildrenLenth === 1) {
      props.children = maybeChildren[0]
    } else {
      props.children = maybeChildren
    }
  }
  return ReactElement(type, key, ref, props)
}

export const jsxDEV = jsx;