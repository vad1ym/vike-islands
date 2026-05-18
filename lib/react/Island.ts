import React from 'react'
import type { ComponentType, ReactElement } from 'react'
import type { HydrateMode, UpdateMode } from '../core/types'

type IslandProps<P extends Record<string, unknown>> = P & {
  name: string
  component: ComponentType<P>
  hydrate?: HydrateMode
  update?: UpdateMode
}

let islandCounter = 0

function nextIslandId(): string {
  islandCounter += 1
  return `i${islandCounter}`
}

export function Island<P extends Record<string, unknown>>(props: IslandProps<P>): ReactElement {
  const {
    name,
    component: Component,
    hydrate = 'visible',
    update = 'static',
    ...componentProps
  } = props

  const islandId = nextIslandId()

  return React.createElement(
    'div',
    {
      'data-island': name,
      'data-island-id': islandId,
      'data-hydrate': hydrate,
      'data-update': update,
      'data-island-props': JSON.stringify(componentProps),
    },
    React.createElement(Component, componentProps as unknown as P),
  )
}
