import Link from "next/link";
import { FaCircleQuestion, FaShield } from "react-icons/fa6";
import { FaShieldAlt } from "react-icons/fa";
import { BsExclamationCircle } from "react-icons/bs";
import { GoPeople } from "react-icons/go";
import { LuPhoneCall } from "react-icons/lu";
import { GrLocation } from "react-icons/gr";
import { LuShield } from "react-icons/lu";

const baseLinkClass =
  "inline-flex items-center rounded-md gap-4 px-3 py-2 transition-colors hover:bg-gray-200 hover:text-black";

const Navbar = () => {
  return (
    <header className="w-full border-b-2 border-black bg-white">
      <nav className="flex min-h-16 w-full items-center justify-between px-50 sm:px-6">
        <div className="flex items-center gap-2">
          <FaShield className="text-xl text-red-600" />
          <h1 className="text-lg font-semibold tracking-tight text-red-600">
            Safe Guardian App
          </h1>
        </div>
        <div className="flex items-center gap-4 text-xl text-gray-700">
          <FaCircleQuestion className="cursor-pointer transition-colors hover:text-black" />
          <FaShieldAlt className="cursor-pointer transition-colors hover:text-black" />
        </div>
      </nav>
      <ul className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 bg-gray-100 justify-around ">
        <li>
          <Link href="/" className={baseLinkClass}>
            <BsExclamationCircle />
            <span>SOS</span>
          </Link>
        </li>
        <li>
          <Link href="/contacts" className={baseLinkClass}>
            <GoPeople />
            <span>Contacts</span>
          </Link>
        </li>
        <li>
          <Link href="#" className={baseLinkClass}>
            <LuPhoneCall />
            <span>Emergency Call</span>
          </Link>
        </li>
        <li>
          <Link href="#" className={baseLinkClass}>
            <GrLocation />
            <span>Location</span>
          </Link>
        </li>
        <li>
          <Link href="#" className={baseLinkClass}>
            <LuShield />
            <span>Check in</span>
          </Link>
        </li>
      </ul>
    </header>
  );
};

export default Navbar;
