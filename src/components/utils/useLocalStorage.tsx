import {useEffect, useState} from "react";
import {readStorage, writeStorage} from "./storage";

// Define a generic type for the initial value
type InitialValueType<T> = T | (() => T);

const isEmptyObject = (obj: unknown): obj is object =>
  typeof obj === "object" && obj !== null && Object.keys(obj).length === 0;

const getStoredData = <T,>(
	key: string,
	initialValue: InitialValueType<T>
): T => {
	const storedData = readStorage(key);
	let data: T | null = null;

	if (storedData) {
		try {
			data = JSON.parse(storedData) as T;
		} catch {
			data = null;
		}
	}

	if (initialValue instanceof Function) {
		return initialValue();
	}

	if (Array.isArray(data) && data.length === 0) {
		return initialValue;
	}

	if (isEmptyObject(data)) {
		return initialValue;
	}

	return data ?? initialValue;
};

const useLocalStorage = <T,>(
	key: string,
	initialValue: InitialValueType<T>
): [T, React.Dispatch<React.SetStateAction<T>>] => {
	const [value, setValue] = useState(() => getStoredData(key, initialValue));

	// Auto save data to the local storage
	useEffect(() => {
		writeStorage(key, JSON.stringify(value));
	}, [key, value]);

	return [value, setValue];
};

export default useLocalStorage;
