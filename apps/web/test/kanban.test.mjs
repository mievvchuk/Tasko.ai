import assert from "node:assert/strict";
import { test } from "node:test";
import { boardLanes, laneRule, moveRule, movedTask } from "../src/kanban.ts";

const owner = { isOwner: true, isAssignee: false, isMember: false };
const assignee = { isOwner: false, isAssignee: true, isMember: true };
const member = { isOwner: false, isAssignee: false, isMember: true };
const task = (status, assigneeId = "f1") => ({
  id: "t1",
  status,
  assigneeId,
  columnId: null,
});

test("the board has a separate lane for returned work", () => {
  assert.deepEqual(
    boardLanes([]).map((lane) => lane.status),
    ["TODO", "IN_PROGRESS", "REVIEW", "REVISION", "DONE"],
  );
});

test("the freelancer moves work forward but never completes it", () => {
  assert.equal(moveRule(task("TODO"), "IN_PROGRESS", assignee).allowed, true);
  assert.deepEqual(moveRule(task("IN_PROGRESS"), "REVIEW", assignee), {
    allowed: true,
    needs: "comment",
  });
  assert.equal(moveRule(task("REVIEW"), "DONE", assignee).allowed, false);
  assert.equal(moveRule(task("IN_PROGRESS"), "DONE", assignee).allowed, false);
  assert.equal(moveRule(task("REVISION"), "IN_PROGRESS", assignee).allowed, true);
});

test("the client accepts work or returns it with a reason", () => {
  assert.equal(moveRule(task("REVIEW"), "DONE", owner).allowed, true);
  assert.deepEqual(moveRule(task("REVIEW"), "REVISION", owner), {
    allowed: true,
    needs: "reason",
  });
  assert.deepEqual(moveRule(task("DONE"), "REVISION", owner), {
    allowed: true,
    needs: "reason",
  });
});

test("a member takes a free task but not someone else's", () => {
  assert.deepEqual(moveRule(task("TODO", null), "IN_PROGRESS", member), {
    allowed: true,
    takes: true,
  });
  assert.equal(moveRule(task("TODO"), "IN_PROGRESS", member).allowed, false);
});

test("dropping a card into its own lane is not a move", () => {
  const [todo, inProgress] = boardLanes([]);
  assert.equal(laneRule(task("TODO"), todo, assignee).allowed, false);
  assert.equal(laneRule(task("TODO"), inProgress, assignee).allowed, true);
});

test("an optimistic move keeps the card and assigns a taken task", () => {
  const lane = { key: "c1", status: "IN_PROGRESS", columnId: "c1" };
  assert.deepEqual(movedTask(task("TODO", null), lane, "me"), {
    id: "t1",
    status: "IN_PROGRESS",
    assigneeId: "me",
    columnId: "c1",
  });
});
