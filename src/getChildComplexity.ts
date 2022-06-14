import { ComplexityNode, Extra } from '.';
import { mergeExtra } from './mergeExtra';
import { nonNullable } from './utils';

export type GetChildComplexity = (children: ComplexityNode[] | null) => ChildComplexity;

export type ChildComplexity = {
  children: ComplexityNode[];
  childComplexity: number;
  extra?: Extra;
};

export const getChildComplexity: GetChildComplexity = (children) => {
  if (!children || !children?.length) {
    return { children: [], childComplexity: 0 };
  }

  /**
   * If it's a union, then pick the most costly member
   */
  if (children[0].isInlineFragmentType) {
    const sortedChildren = children.sort((a, b) => b.cost - a.cost);
    sortedChildren[0].selected = true;
    const childComplexity = sortedChildren[0].cost;

    return {
      children: sortedChildren,
      childComplexity,
      extra: mergeExtra('max', ...children.map((child) => child.extra).filter(nonNullable)),
    };
  }

  /**
   * If it's an object type, sum the childs up.
   */
  let childComplexity = 0;
  const selectedChildren = children.map((child) => {
    childComplexity = childComplexity + child.cost;
    child.selected = true;
    return child;
  });

  return {
    children: selectedChildren,
    childComplexity,
    extra: mergeExtra('sum', ...children.map((child) => child.extra).filter(nonNullable)),
  };
};
