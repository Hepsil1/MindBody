import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

export type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "warning";

interface CommonProps {
    variant?: AdminButtonVariant;
    size?: "md" | "sm";
    block?: boolean;
    children: ReactNode;
    className?: string;
}

/** Build the shared className for an admin button. */
function adminButtonClass(
    variant: AdminButtonVariant = "primary",
    size: "md" | "sm" = "md",
    block?: boolean,
    extra?: string,
): string {
    return [
        "admin-btn",
        `admin-btn--${variant}`,
        size === "sm" ? "admin-btn--sm" : "",
        block ? "admin-btn--block" : "",
        extra ?? "",
    ]
        .filter(Boolean)
        .join(" ");
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * The one admin button. Replaces the per-page inline teal-blob buttons with a
 * variant on the shared .admin-btn system (see admin.css). Use AdminLinkButton
 * for navigation.
 */
export function AdminButton({
    variant,
    size,
    block,
    className,
    children,
    type = "button",
    ...rest
}: ButtonProps) {
    return (
        <button type={type} className={adminButtonClass(variant, size, block, className)} {...rest}>
            {children}
        </button>
    );
}

type LinkButtonProps = CommonProps & Omit<LinkProps, "className">;

/** Same look as AdminButton, rendered as a router <Link>. */
export function AdminLinkButton({
    variant,
    size,
    block,
    className,
    children,
    ...rest
}: LinkButtonProps) {
    return (
        <Link className={adminButtonClass(variant, size, block, className)} {...rest}>
            {children}
        </Link>
    );
}
