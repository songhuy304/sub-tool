"use client";

import * as React from "react";

import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Button } from "./button";
import { Input } from "./input";
import {
  InputGroupButton,
  InputGroupInput
} from "./input-group";
import { Icons } from "../icons";

type InputPasswordProps = React.ComponentProps<typeof InputGroupInput>;

export function InputPassword({ className, ...props }: InputPasswordProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  const togglePasswordVisibility = () => {
    setShowPassword((prevState) => !prevState);
  }

  return (
    <Input
      {...props}
      id="password-toggle"
      placeholder="Enter your password"
      type={showPassword ? "text" : "password"}
      rightIcon={
        <InputGroupButton onClick={togglePasswordVisibility} className="p-0">
          {showPassword ? (
            <Icons.eye onClick={togglePasswordVisibility} />
          ) : (
            <Icons.eyeOff onClick={togglePasswordVisibility} />
          )}
        </InputGroupButton>
      }
    />

  );
}
