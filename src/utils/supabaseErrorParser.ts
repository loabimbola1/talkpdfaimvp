/**
 * Parse Supabase errors into user-friendly messages
 */

interface ParsedError {
  message: string;
  type: "duplicate" | "not_authorized" | "rls_violation" | "not_found" | "validation" | "unknown";
}

export function parseSupabaseError(error: any): ParsedError {
  const errorMessage = error?.message || error?.toString() || "";
  const errorCode = error?.code || "";

  // Duplicate key violation (unique constraint)
  if (
    errorCode === "23505" ||
    errorMessage.includes("duplicate key") ||
    errorMessage.includes("unique constraint") ||
    errorMessage.includes("already exists")
  ) {
    return {
      message: "You've already joined this group!",
      type: "duplicate",
    };
  }

  // RLS policy violation
  if (
    errorMessage.includes("row-level security") ||
    errorMessage.includes("RLS") ||
    errorMessage.includes("violates row-level security policy") ||
    errorCode === "42501"
  ) {
    return {
      message: "You don't have permission to perform this action.",
      type: "rls_violation",
    };
  }

  // Foreign key violation (referenced entity not found)
  if (errorCode === "23503" || errorMessage.includes("foreign key")) {
    return {
      message: "The referenced item no longer exists.",
      type: "not_found",
    };
  }

  // Not found errors
  if (
    errorMessage.includes("No rows found") ||
    errorMessage.includes("not found") ||
    errorCode === "PGRST116"
  ) {
    return {
      message: "The requested item was not found.",
      type: "not_found",
    };
  }

  // Authorization errors
  if (
    errorMessage.includes("not authenticated") ||
    errorMessage.includes("Not authenticated") ||
    errorMessage.includes("JWT") ||
    errorCode === "401"
  ) {
    return {
      message: "Please sign in to continue.",
      type: "not_authorized",
    };
  }

  // Validation errors
  if (
    errorMessage.includes("check constraint") ||
    errorMessage.includes("invalid input") ||
    errorCode === "22P02"
  ) {
    return {
      message: "Please check your input and try again.",
      type: "validation",
    };
  }

  // Default fallback
  return {
    message: "Something went wrong. Please try again.",
    type: "unknown",
  };
}

/**
 * Get a user-friendly error message for study group operations
 */
export function getStudyGroupErrorMessage(error: any, operation: "create" | "join" | "leave" | "view"): string {
  const parsed = parseSupabaseError(error);

  switch (operation) {
    case "create":
      if (parsed.type === "duplicate") {
        return "A group with this name already exists. Try a different name.";
      }
      if (parsed.type === "rls_violation") {
        return "You don't have permission to create groups. Please sign in.";
      }
      return "Failed to create group. Please try again.";

    case "join":
      if (parsed.type === "duplicate") {
        return "You're already a member of this group!";
      }
      if (parsed.type === "not_found") {
        return "Invalid invite code. Please check and try again.";
      }
      if (parsed.type === "rls_violation") {
        return "Unable to join this group. Please sign in and try again.";
      }
      return "Failed to join group. Please try again.";

    case "leave":
      if (parsed.type === "rls_violation") {
        return "You cannot leave this group. You may be the only admin.";
      }
      return "Failed to leave group. Please try again.";

    case "view":
      if (parsed.type === "not_authorized") {
        return "Please sign in to view group details.";
      }
      return "Failed to load group details. Please try again.";

    default:
      return parsed.message;
  }
}
