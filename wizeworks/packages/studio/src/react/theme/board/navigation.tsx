'use client';

// Getting around — the part of a theme that has to say WHERE YOU ARE.
//
// Selection is a filled shape, not a hairline: the pills variant is here first
// because it is the one that answers the question without being read.

import {
  Breadcrumb,
  Menu,
  MenuItem,
  Pagination,
  Tabs,
  TabsList,
  TabsTab,
} from '@wizeworks/silicaui-react';
import { BoardTile, Specimen } from './tile';

export function NavigationTile() {
  return (
    <BoardTile
      title="Getting around"
      hint="Menus and tabs, and how clearly they say where you are."
    >
      <Tabs defaultValue="menu" variant="pills" color="primary">
        <TabsList>
          <TabsTab value="menu">Menu</TabsTab>
          <TabsTab value="orders">Orders</TabsTab>
          <TabsTab value="hours">Opening hours</TabsTab>
        </TabsList>
      </Tabs>

      <Tabs defaultValue="menu" variant="underline" color="primary">
        <TabsList>
          <TabsTab value="menu">Menu</TabsTab>
          <TabsTab value="orders">Orders</TabsTab>
          <TabsTab value="hours">Opening hours</TabsTab>
        </TabsList>
      </Tabs>

      <Breadcrumb>
        <li>
          <a href="#board-sample">Home</a>
        </li>
        <li>
          <a href="#board-sample">Bread</a>
        </li>
        <li>
          <span aria-current="page">Sourdough</span>
        </li>
      </Breadcrumb>

      <Menu className="w-full">
        <MenuItem>
          <a href="#board-sample">Todays bakes</a>
        </MenuItem>
        <MenuItem>
          <a href="#board-sample">Standing orders</a>
        </MenuItem>
      </Menu>

      <Specimen label="Paging through a long list">
        <Pagination color="primary" page={2} count={7} />
      </Specimen>
    </BoardTile>
  );
}
