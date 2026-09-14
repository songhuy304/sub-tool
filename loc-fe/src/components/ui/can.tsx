interface CanProps {
    can: boolean;
    children: React.ReactNode;
}
const Can = ({ can, children }: CanProps) => {
    if (!can) {
        return null;
    }
    return (
        <>{children}</>
    )
}

export { Can }