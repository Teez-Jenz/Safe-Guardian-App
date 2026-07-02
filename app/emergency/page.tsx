import EmergencyContacts from "../components/EmergencyContacts";
import NearbyStations from "../components/NearbyStations";

const EmergencyPage = () => {
  return (
    <>
      <main className="w-full h-full p-8 bg-gray-100">
        <div className="w-full bg-white border-gray-300 rounded-xl shadow-md p-5">
          <h1 className="text-black font-bold">Emergnecy Hotlines</h1>
          <p className="text-gray-500">Quick access to emergency services</p>
          <div className="p-5">
            <EmergencyContacts />
          </div>
        </div>
        
          <div>
            <NearbyStations />
          </div>
      </main>
      ;
    </>
  );
};

export default EmergencyPage;
