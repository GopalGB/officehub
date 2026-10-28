// Preserve old allocations without offering Admin/inactive IDs as new choices.
export const KEEP_ASSIGNMENT = "__keep_current_assignment__";
export function preserveCurrentAllocations(fd: FormData) {
  for (const field of ["ownerId", "coOwnerId", "assigneeId"]) {
    if (fd.get(field) === KEEP_ASSIGNMENT) fd.delete(field);
  }
  return fd;
}
