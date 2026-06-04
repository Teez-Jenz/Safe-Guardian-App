import { HiOutlineExclamationCircle } from "react-icons/hi2";
import { GrLocation } from "react-icons/gr";

const page = () => {
  return (
    <main className="w-full h-full p-8 bg-gray-50">
      <section className="w-full h-full border-2 border-gray-300 rounded-lg p-8 bg-white">
        <h1 className="text-2xl text-black font-medium">Emergency Alert</h1>
        <p className="text-gray-500 pt-3">
          Press the button below to immediately alert your trusted contacts.
        </p>
        <div className="w-full mt-8 flex items-center justify-center py-10">
          <div className="w-50 h-50 bg-red-600 rounded-full flex items-center justify-center   cursor-pointer transform transition duration-300 hover:scale-110">
            <div className="flex flex-col items-center justify-center gap-2">
              <HiOutlineExclamationCircle />
              <span className="text-3xl font-bold text-white">SOS</span>
              <span className="text-sm text-white">Tap to Alert</span>
            </div>
          </div>
        </div>

        <div className="w-full h-full border-2 bordder-gray-300 rounded-2xl flex flex-row items-center gap-4 p-8 bg-gray-200 ">
          <span className=" text-gray-500">
            <GrLocation />
          </span>
          <h2 className=" font-medium text-black">Current Location</h2>
        </div>
      </section>

      <section className="w-full h-full border-2 border-gray-300 rounded-lg p-8 bg-white mt-8">
        <h2 className="text-black">Quick Info</h2>
        <ul className="list-disc list-inside text-gray-500 mt-4">
          <li>Your location is being tracked when SOS is active</li>
          <li>
            Keep your trusted contacts updated with your current information.
          </li>
          <li>Regularly review and update your emergency contacts list.</li>
        </ul>
      </section>
    </main>
  );
};

export default page;
