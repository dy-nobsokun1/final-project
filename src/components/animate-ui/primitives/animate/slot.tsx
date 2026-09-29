'use client';

import * as React from 'react';
import { motion, isMotionComponent, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

type AnyProps = Record<string, unknown>;

type DOMMotionProps<T extends HTMLElement = HTMLElement> = Omit<
  HTMLMotionProps<keyof HTMLElementTagNameMap>,
  'ref'
> & { ref?: React.Ref<T> };

type WithAsChild<Base extends object> =
  | (Base & { asChild: true; children: React.ReactElement })
  | (Base & { asChild?: false | undefined });

type SlotProps<T extends HTMLElement = HTMLElement> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children?: any;
} & DOMMotionProps<T>;

function mergeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === 'function') {
        ref(node);
      } else {
        (ref as React.RefObject<T | null>).current = node;
      }
    });
  };
}

function mergeProps<T extends HTMLElement>(
  childProps: AnyProps,
  slotProps: DOMMotionProps<T>,
): AnyProps {
  const merged: AnyProps = { ...childProps, ...slotProps };

  if (childProps.className || slotProps.className) {
    merged.className = cn(
      childProps.className as string,
      slotProps.className as string,
    );
  }

  if (childProps.style || slotProps.style) {
    merged.style = {
      ...(childProps.style as React.CSSProperties),
      ...(slotProps.style as React.CSSProperties),
    };
  }

  return merged;
}

function Slot<T extends HTMLElement = HTMLElement>({
  children,
  ref,
  ...props
}: SlotProps<T>) {

  // LOCAL PATCH: upstream reads `children.type` before checking that `children`
  // is a valid element, which threw "Cannot read properties of undefined
  // (reading 'displayName')" whenever `Slot` was rendered without an element
  // child. `Effect` with `asChild` renders `<Component {...props} />` and does
  // not forward children, so that path is reachable. `isValidElement` is now
  // checked first and `type` is read only once it is known to be a string or a
  // component -- an early return cannot be used here because it would place the
  // `useMemo` below a conditional, breaking the rules of hooks. Note: re-running
  // `shadcn add --overwrite` will revert this.
  const isValidChild = React.isValidElement(children);
  const childType = isValidChild ? (children.type as React.ElementType) : null;

  const isAlreadyMotion =
    typeof childType === 'object' &&
    childType !== null &&
    isMotionComponent(childType);

  const Base = React.useMemo(
    () =>
      childType === null
        ? null
        : isAlreadyMotion
          ? childType
          : motion.create(childType),
    [childType, isAlreadyMotion],
  );

  if (!isValidChild || Base === null) return null;

  const { ref: childRef, ...childProps } = children.props as AnyProps;

  const mergedProps = mergeProps(childProps, props);

  return (
    // Vendored from the Animate UI shadcn registry. `Base` is a `useMemo`d
    // component (stable across renders, unlike the inline `motion.create` it
    // caches), so `react-hooks/static-components` is a false positive here.
    // Disabled locally rather than relaxing the project config. Note that
    // re-running `shadcn add --overwrite` will remove this again.
    // eslint-disable-next-line react-hooks/static-components
    <Base {...mergedProps} ref={mergeRefs(childRef as React.Ref<T>, ref)} />
  );
}

export {
  Slot,
  type SlotProps,
  type WithAsChild,
  type DOMMotionProps,
  type AnyProps,
};
